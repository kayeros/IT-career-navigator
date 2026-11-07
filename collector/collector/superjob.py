"""Загрузчик вакансий SuperJob API v2 (https://api.superjob.ru) в vacancies и import_runs."""

import hashlib
import logging
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
import psycopg
from psycopg.types.json import Jsonb

log = logging.getLogger(__name__)

API_URL = "https://api.superjob.ru/2.0/vacancies/"
PAGE_SIZE = 100
# SuperJob отдаёт не больше 500 вакансий на один поисковый запрос.
MAX_RESULTS = 500
# Пауза между запросами, чтобы не упираться в лимит API.
REQUEST_PAUSE = 0.5

# experience в SuperJob: 1 — без опыта, 2 — от 1 года до 3 лет. Берём оба, это junior.
EXPERIENCE = {1: "none", 2: "1_3"}


@dataclass(frozen=True)
class Search:
    """Поисковые запросы профессии и фильтр по названию вакансии от шума выдачи."""

    keywords: tuple[str, ...]
    title_pattern: re.Pattern


SEARCHES: dict[str, Search] = {
    "qa-manual": Search(
        keywords=("тестировщик", "QA инженер", "QA engineer", "специалист по тестированию"),
        title_pattern=re.compile(r"тестиров|\bqa\b", re.I),
    ),
    "python-developer": Search(
        keywords=("python разработчик", "python developer", "программист python"),
        title_pattern=re.compile(r"python|питон", re.I),
    ),
    "java-developer": Search(
        keywords=("java разработчик", "java developer", "программист java"),
        title_pattern=re.compile(r"\bjava\b(?!\s*script)", re.I),
    ),
}


@dataclass
class Vacancy:
    external_id: str
    url: str | None
    title: str
    company: str | None
    region: str | None
    experience: str | None
    salary_from: int | None
    salary_to: int | None
    published_at: datetime | None
    raw_text: str


def parse_vacancy(obj: dict) -> Vacancy:
    """Переводит объект вакансии SuperJob в строку таблицы vacancies."""
    rub = (obj.get("currency") or "rub") == "rub"
    published = obj.get("date_published")
    text_parts = [obj.get("vacancyRichText") or "", obj.get("candidat") or "", obj.get("work") or ""]
    return Vacancy(
        external_id=str(obj["id"]),
        url=obj.get("link"),
        title=(obj.get("profession") or "").strip(),
        company=obj.get("firm_name") or None,
        region=(obj.get("town") or {}).get("title"),
        experience=EXPERIENCE.get((obj.get("experience") or {}).get("id")),
        salary_from=(obj.get("payment_from") or None) if rub else None,
        salary_to=(obj.get("payment_to") or None) if rub else None,
        published_at=datetime.fromtimestamp(published, tz=timezone.utc) if published else None,
        raw_text=strip_html("\n".join(p for p in text_parts if p)),
    )


def strip_html(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;|&#160;", " ", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def dedup_hash(v: Vacancy) -> str:
    """Отпечаток для склейки дублей между источниками: название + компания + город."""
    key = "|".join(re.sub(r"\W+", " ", (s or "").lower()).strip() for s in (v.title, v.company, v.region))
    return hashlib.sha1(key.encode()).hexdigest()


def fetch(client: httpx.Client, keyword: str, experience: int):
    """Постранично отдаёт объекты вакансий по одному запросу."""
    page = 0
    while page * PAGE_SIZE < MAX_RESULTS:
        resp = client.get(API_URL, params={
            "keyword": keyword,
            "experience": experience,
            "count": PAGE_SIZE,
            "page": page,
        })
        resp.raise_for_status()
        data = resp.json()
        yield from data.get("objects", [])
        if not data.get("more"):
            return
        page += 1
        time.sleep(REQUEST_PAUSE)


def load(conn: psycopg.Connection, api_key: str, profession_slug: str) -> None:
    if not api_key:
        raise SystemExit("не задан SUPERJOB_API_KEY — добавьте ключ в .env")
    search = SEARCHES.get(profession_slug)
    if search is None:
        raise SystemExit(f"нет поисковых запросов для профессии {profession_slug!r}; есть: {', '.join(SEARCHES)}")

    row = conn.execute("SELECT id FROM professions WHERE slug = %s", (profession_slug,)).fetchone()
    if row is None:
        raise SystemExit(f"профессии {profession_slug!r} нет в базе — сначала `api seed`")
    profession_id = row[0]

    source_id = conn.execute("""
        INSERT INTO vacancy_sources (code, name) VALUES ('superjob', 'SuperJob')
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id""").fetchone()[0]
    run_id = conn.execute(
        "INSERT INTO import_runs (source_id, status) VALUES (%s, 'running') RETURNING id", (source_id,)
    ).fetchone()[0]
    conn.commit()

    fetched = inserted = duplicates = 0
    seen: set[str] = set()
    try:
        headers = {"X-Api-App-Id": api_key}
        with httpx.Client(headers=headers, timeout=30) as client:
            for keyword in search.keywords:
                for experience in EXPERIENCE:
                    for obj in fetch(client, keyword, experience):
                        v = parse_vacancy(obj)
                        if v.external_id in seen or not search.title_pattern.search(v.title):
                            continue
                        seen.add(v.external_id)
                        fetched += 1
                        if insert_vacancy(conn, source_id, run_id, profession_id, v):
                            inserted += 1
                        else:
                            duplicates += 1
                    conn.commit()
    except Exception as exc:
        conn.rollback()
        conn.execute("""
            UPDATE import_runs SET status = 'failed', finished_at = now(), fetched = %s, inserted = %s,
                   duplicates = %s, error = %s WHERE id = %s""",
                     (fetched, inserted, duplicates, str(exc)[:2000], run_id))
        conn.commit()
        raise

    conn.execute("""
        UPDATE import_runs SET status = 'ok', finished_at = now(), fetched = %s, inserted = %s, duplicates = %s
        WHERE id = %s""", (fetched, inserted, duplicates, run_id))
    conn.commit()
    log.info("SuperJob %s: получено %d, новых %d, уже были %d", profession_slug, fetched, inserted, duplicates)


def insert_vacancy(conn: psycopg.Connection, source_id: int, run_id: int, profession_id: int, v: Vacancy) -> bool:
    """Вставляет вакансию; уникальность — (источник, external_id). Возвращает True, если она новая."""
    cur = conn.execute("""
        INSERT INTO vacancies (source_id, import_run_id, external_id, url, title, company, region, experience,
                               salary_from, salary_to, published_at, raw_text, key_skills_raw,
                               profession_id, profession_status, dedup_hash)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'auto', %s)
        ON CONFLICT (source_id, external_id) DO NOTHING""",
                       (source_id, run_id, v.external_id, v.url, v.title, v.company, v.region, v.experience,
                        v.salary_from, v.salary_to, v.published_at, v.raw_text, Jsonb(None),
                        profession_id, dedup_hash(v)))
    return cur.rowcount == 1
