"""Загрузчик вакансий «Работа России» (открытые данные https://opendata.trudvsem.ru, ключ не нужен).

Сохраняем только описание вакансии и её навыки. Контакты работодателя (телефоны, почты, ФИО)
из ответа API не храним: для анализа они не нужны.
"""

import logging
import time
from datetime import datetime, timezone

import httpx
import psycopg

from collector.vacancies import (SEARCHES, Vacancy, ensure_source, finish_run, insert_vacancy, profession_id,
                                 start_run, strip_html)

log = logging.getLogger(__name__)

API_URL = "https://opendata.trudvsem.ru/api/v1/vacancies"
PAGE_SIZE = 100  # больше API не отдаёт
MAX_PAGES = 10
REQUEST_PAUSE = 0.5
USER_AGENT = "careernav-collector/0.1"


def experience(years) -> str | None:
    """Опыт в годах → junior-категория; больше 3 лет — не junior (None)."""
    if not isinstance(years, int):
        return "none"
    if years <= 0:
        return "none"
    if years <= 3:
        return "1_3"
    return None


def parse_vacancy(obj: dict) -> Vacancy:
    """Переводит объект vacancy из ответа API в строку таблицы vacancies."""
    created = obj.get("creation-date")
    text = "\n".join(p for p in (obj.get("duty") or "", obj.get("requirements") or "") if p)
    skills = [s.strip() for s in (obj.get("skills") or []) if isinstance(s, str) and s.strip()]
    return Vacancy(
        external_id=str(obj["id"]),
        url=obj.get("vac_url"),
        title=(obj.get("job-name") or "").strip(),
        company=(obj.get("company") or {}).get("name"),
        region=(obj.get("region") or {}).get("name"),
        experience=experience((obj.get("requirement") or {}).get("experience")),
        salary_from=obj.get("salary_min") or None,
        salary_to=obj.get("salary_max") or None,
        published_at=datetime.fromisoformat(created).replace(tzinfo=timezone.utc) if created else None,
        raw_text=strip_html(text),
        key_skills=list(dict.fromkeys(skills)),
    )


def fetch(client: httpx.Client, text: str):
    """Постранично отдаёт объекты вакансий. offset в этом API — номер страницы."""
    for page in range(MAX_PAGES):
        resp = client.get(API_URL, params={"text": text, "offset": page, "limit": PAGE_SIZE})
        resp.raise_for_status()
        items = ((resp.json().get("results") or {}).get("vacancies")) or []
        for it in items:
            if "vacancy" in it:
                yield it["vacancy"]
        if len(items) < PAGE_SIZE:
            return
        time.sleep(REQUEST_PAUSE)


def load(conn: psycopg.Connection, profession_slug: str) -> None:
    search = SEARCHES.get(profession_slug)
    if search is None:
        raise SystemExit(f"нет поисковых запросов для профессии {profession_slug!r}; есть: {', '.join(SEARCHES)}")

    pid = profession_id(conn, profession_slug)
    source_id = ensure_source(conn, "trudvsem", "Работа России")
    run_id = start_run(conn, source_id)

    fetched = inserted = duplicates = 0
    seen: set[str] = set()
    try:
        with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=30) as client:
            for keyword in search.keywords:
                for obj in fetch(client, keyword):
                    v = parse_vacancy(obj)
                    if (v.external_id in seen or v.experience is None
                            or not search.title_pattern.search(v.title)):
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
    log.info("Работа России %s: получено %d, новых %d, уже были %d", profession_slug, fetched, inserted, duplicates)
