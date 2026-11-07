"""Загрузчик вакансий SuperJob API v2 (https://api.superjob.ru) в vacancies и import_runs."""

import logging
import time
from datetime import datetime, timezone

import httpx
import psycopg

from collector.vacancies import (SEARCHES, Vacancy, ensure_source, finish_run, insert_vacancy, profession_id,
                                 start_run, strip_html)

log = logging.getLogger(__name__)

API_URL = "https://api.superjob.ru/2.0/vacancies/"
PAGE_SIZE = 100
# SuperJob отдаёт не больше 500 вакансий на один поисковый запрос.
MAX_RESULTS = 500
# Пауза между запросами, чтобы не упираться в лимит API.
REQUEST_PAUSE = 0.5

# experience в SuperJob: 1 — без опыта, 2 — от 1 года до 3 лет. Берём оба, это junior.
EXPERIENCE = {1: "none", 2: "1_3"}


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

    pid = profession_id(conn, profession_slug)
    source_id = ensure_source(conn, "superjob", "SuperJob")
    run_id = start_run(conn, source_id)

    fetched = inserted = duplicates = 0
    seen: set[str] = set()
    try:
        with httpx.Client(headers={"X-Api-App-Id": api_key}, timeout=30) as client:
            for keyword in search.keywords:
                for experience in EXPERIENCE:
                    for obj in fetch(client, keyword, experience):
                        v = parse_vacancy(obj)
                        if v.external_id in seen or not search.title_pattern.search(v.title):
                            continue
                        seen.add(v.external_id)
                        fetched += 1
                        if insert_vacancy(conn, source_id, run_id, pid, v):
                            inserted += 1
                        else:
                            duplicates += 1
                    conn.commit()
    except Exception as exc:
        conn.rollback()
        finish_run(conn, run_id, fetched, inserted, duplicates, str(exc))
        raise

    finish_run(conn, run_id, fetched, inserted, duplicates)
    log.info("SuperJob %s: получено %d, новых %d, уже были %d", profession_slug, fetched, inserted, duplicates)
