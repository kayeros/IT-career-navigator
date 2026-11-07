"""Веса навыков: доля вакансий профессии с навыком → weight_snapshots + skill_weights."""

import logging
from datetime import date
from statistics import median

import psycopg

log = logging.getLogger(__name__)

# Вакансии старше 12 месяцев в расчёт не берём (столько храним сырые вакансии).
WINDOW = "12 months"
# Меньше — снимок предварительный (флаг preliminary в API). Для MVP публикуем и такие.
MIN_VACANCIES = 200


def compute_weights(vacancy_skills: dict[int, set[int]]) -> dict[int, float]:
    """vacancy_id → навыки вакансии  ⇒  skill_id → доля вакансий с навыком (0–1)."""
    total = len(vacancy_skills)
    if total == 0:
        return {}
    counts: dict[int, int] = {}
    for skills in vacancy_skills.values():
        for skill_id in skills:
            counts[skill_id] = counts.get(skill_id, 0) + 1
    return {skill_id: round(n / total, 4) for skill_id, n in counts.items()}


def salary_median(salaries: list[tuple[int | None, int | None]]) -> int | None:
    """Медиана зарплаты по вилке: середина, если указаны обе границы, иначе та, что есть."""
    values = []
    for lo, hi in salaries:
        if lo and hi:
            values.append((lo + hi) / 2)
        elif lo or hi:
            values.append(lo or hi)
    return int(median(values)) if values else None


def calc(conn: psycopg.Connection, profession_slug: str | None) -> None:
    query = "SELECT id, slug FROM professions WHERE status = 'available'"
    params: tuple = ()
    if profession_slug:
        query += " AND slug = %s"
        params = (profession_slug,)
    professions = conn.execute(query, params).fetchall()
    if not professions:
        raise SystemExit(f"профессия {profession_slug!r} не найдена или не доступна")

    period = date.today().replace(day=1)
    for profession_id, slug in professions:
        rows = conn.execute(f"""
            SELECT v.id, v.salary_from, v.salary_to, vs.skill_id
            FROM vacancies v LEFT JOIN vacancy_skills vs ON vs.vacancy_id = v.id
            WHERE v.profession_id = %s AND v.duplicate_of_id IS NULL
              AND coalesce(v.published_at, v.fetched_at) > now() - interval '{WINDOW}'""",
                            (profession_id,)).fetchall()
        vacancy_skills: dict[int, set[int]] = {}
        salaries: dict[int, tuple] = {}
        for vacancy_id, lo, hi, skill_id in rows:
            vacancy_skills.setdefault(vacancy_id, set())
            salaries[vacancy_id] = (lo, hi)
            if skill_id is not None:
                vacancy_skills[vacancy_id].add(skill_id)

        if not vacancy_skills:
            log.warning("%s: нет вакансий — снимок не создан", slug)
            continue

        weights = compute_weights(vacancy_skills)
        count = len(vacancy_skills)
        with conn.transaction():
            snapshot_id = conn.execute("""
                INSERT INTO weight_snapshots (profession_id, period, vacancy_count, salary_median, status, published_at)
                VALUES (%s, %s, %s, %s, 'published', now())
                ON CONFLICT (profession_id, period) DO UPDATE
                SET vacancy_count = EXCLUDED.vacancy_count, salary_median = EXCLUDED.salary_median,
                    status = 'published', calculated_at = now(), published_at = now()
                RETURNING id""", (profession_id, period, count, salary_median(list(salaries.values())))).fetchone()[0]
            conn.execute("DELETE FROM skill_weights WHERE snapshot_id = %s", (snapshot_id,))
            for skill_id, weight in weights.items():
                conn.execute("INSERT INTO skill_weights (snapshot_id, skill_id, weight) VALUES (%s, %s, %s)",
                             (snapshot_id, skill_id, weight))
        note = " (предварительный: меньше %d вакансий)" % MIN_VACANCIES if count < MIN_VACANCIES else ""
        log.info("%s: снимок за %s — вакансий %d, навыков с весом %d%s", slug, period, count, len(weights), note)
