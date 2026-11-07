"""Общее для всех источников: поисковые запросы профессий, запись вакансии, отпечаток для склейки дублей."""

import hashlib
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime

import psycopg
from psycopg.types.json import Jsonb

log = logging.getLogger(__name__)

# Сырые вакансии храним 12 месяцев.
KEEP = "12 months"


@dataclass(frozen=True)
class Search:
    """Поисковые запросы профессии и фильтр по названию вакансии от шума выдачи.

    keywords — фразы для поиска по всему тексту («Работа России»);
    title_words — отдельные слова для поиска только в названии вакансии (SuperJob).
    """

    keywords: tuple[str, ...]
    title_words: tuple[str, ...]
    title_pattern: re.Pattern


SEARCHES: dict[str, Search] = {
    "qa-manual": Search(
        keywords=("тестировщик", "QA инженер", "QA engineer", "специалист по тестированию"),
        title_words=("тестировщик", "тестирование", "QA"),
        title_pattern=re.compile(r"тестиров|\bqa\b", re.I),
    ),
    "python-developer": Search(
        keywords=("python разработчик", "python developer", "программист python"),
        title_words=("python", "питон"),
        title_pattern=re.compile(r"python|питон", re.I),
    ),
    "java-developer": Search(
        keywords=("java разработчик", "java developer", "программист java"),
        title_words=("java",),
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
    key_skills: list[str] = field(default_factory=list)


def strip_html(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;|&#160;", " ", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def dedup_hash(v: Vacancy) -> str:
    """Отпечаток для склейки дублей между источниками: название + компания + регион."""
    def norm(s: str | None) -> str:
        s = (s or "").lower().replace("ё", "е")
        s = re.sub(r"\b(ооо|оао|зао|пао|ао|ип)\b", " ", s)
        return re.sub(r"\W+", " ", s).strip()

    key = "|".join(norm(s) for s in (v.title, v.company, v.region))
    return hashlib.sha1(key.encode()).hexdigest()


def ensure_source(conn: psycopg.Connection, code: str, name: str) -> int:
    return conn.execute("""
        INSERT INTO vacancy_sources (code, name) VALUES (%s, %s)
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id""", (code, name)).fetchone()[0]


def profession_id(conn: psycopg.Connection, slug: str) -> int:
    row = conn.execute("SELECT id FROM professions WHERE slug = %s", (slug,)).fetchone()
    if row is None:
        raise SystemExit(f"профессии {slug!r} нет в базе — сначала `api seed`")
    return row[0]


def insert_vacancy(conn: psycopg.Connection, source_id: int, run_id: int, profession_id: int, v: Vacancy) -> bool:
    """Вставляет вакансию; уникальность — (источник, external_id). Возвращает True, если она новая."""
    cur = conn.execute("""
        INSERT INTO vacancies (source_id, import_run_id, external_id, url, title, company, region, experience,
                               salary_from, salary_to, published_at, raw_text, key_skills_raw,
                               profession_id, profession_status, dedup_hash)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'auto', %s)
        ON CONFLICT (source_id, external_id) DO NOTHING""",
                       (source_id, run_id, v.external_id, v.url, v.title, v.company, v.region, v.experience,
                        v.salary_from, v.salary_to, v.published_at, v.raw_text,
                        Jsonb(v.key_skills) if v.key_skills else None, profession_id, dedup_hash(v)))
    return cur.rowcount == 1


def start_run(conn: psycopg.Connection, source_id: int) -> int:
    run_id = conn.execute(
        "INSERT INTO import_runs (source_id, status) VALUES (%s, 'running') RETURNING id", (source_id,)
    ).fetchone()[0]
    conn.commit()
    return run_id


def finish_run(conn: psycopg.Connection, run_id: int, fetched: int, inserted: int, duplicates: int,
               error: str | None = None) -> None:
    conn.execute("""
        UPDATE import_runs SET status = %s, finished_at = now(), fetched = %s, inserted = %s, duplicates = %s, error = %s
        WHERE id = %s""", ("failed" if error else "ok", fetched, inserted, duplicates, error and error[:2000], run_id))
    conn.commit()


def mark_duplicates(conn: psycopg.Connection) -> int:
    """Склейка дублей: вакансии с одинаковым отпечатком ссылаются на самую раннюю (duplicate_of_id).
    Дубли не участвуют в поиске навыков и расчёте весов."""
    cur = conn.execute("""
        WITH firsts AS (
            SELECT dedup_hash, min(id) AS first_id FROM vacancies
            WHERE dedup_hash IS NOT NULL GROUP BY dedup_hash HAVING count(*) > 1
        )
        UPDATE vacancies v SET duplicate_of_id = f.first_id
        FROM firsts f
        WHERE v.dedup_hash = f.dedup_hash AND v.id <> f.first_id AND v.duplicate_of_id IS DISTINCT FROM f.first_id""")
    conn.commit()
    log.info("склейка дублей: помечено %d вакансий", cur.rowcount)
    return cur.rowcount


def cleanup(conn: psycopg.Connection) -> int:
    """Удаляет сырые вакансии старше 12 месяцев (навыки вакансий удаляются каскадом)."""
    with conn.transaction():
        conn.execute(f"""
            UPDATE vacancies SET duplicate_of_id = NULL
            WHERE duplicate_of_id IN (SELECT id FROM vacancies WHERE fetched_at < now() - interval '{KEEP}')""")
        cur = conn.execute(f"DELETE FROM vacancies WHERE fetched_at < now() - interval '{KEEP}'")
    log.info("чистка: удалено вакансий старше %s — %d", KEEP, cur.rowcount)
    return cur.rowcount
