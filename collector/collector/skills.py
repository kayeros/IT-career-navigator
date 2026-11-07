"""Поиск навыков в тексте вакансий по справочнику skills и синонимам skill_synonyms. Без языковой модели."""

import logging
import re

import psycopg

log = logging.getLogger(__name__)

# Граница «слова» для терминов вроде C#, C++, CI/CD: рядом не должно быть букв, цифр, +, #.
_EDGE = r"[\w+#]"


class SkillMatcher:
    """Сопоставляет текст с навыками: регистронезависимо, по границам слов."""

    def __init__(self, terms: dict[str, int]):
        # Каждый термин ищем отдельно: «Spring» и «Spring Boot» — разные навыки, оба должны найтись.
        self._terms = [
            (t.lower(), skill_id, re.compile(rf"(?<!{_EDGE}){re.escape(t.lower())}(?!{_EDGE})"))
            for t, skill_id in terms.items()
        ]

    def find(self, text: str) -> set[int]:
        found: set[int] = set()
        lowered = text.lower()
        for term, skill_id, pattern in self._terms:
            # Быстрая проверка подстрокой отсекает почти все термины до регулярного выражения.
            if skill_id in found or term not in lowered:
                continue
            if pattern.search(lowered):
                found.add(skill_id)
        return found


def load_matcher(conn: psycopg.Connection) -> SkillMatcher:
    terms: dict[str, int] = {}
    for skill_id, name in conn.execute("SELECT id, name FROM skills"):
        terms[name] = skill_id
    for skill_id, synonym in conn.execute("SELECT skill_id, synonym FROM skill_synonyms"):
        terms[str(synonym)] = skill_id
    return SkillMatcher(terms)


def match_all(conn: psycopg.Connection) -> None:
    """Пересчитывает vacancy_skills для всех вакансий с профессией (кроме дублей)."""
    matcher = load_matcher(conn)
    rows = conn.execute("""
        SELECT id, title, coalesce(raw_text, '') FROM vacancies
        WHERE profession_id IS NOT NULL AND duplicate_of_id IS NULL""").fetchall()

    links = 0
    with conn.transaction():
        for vacancy_id, title, text in rows:
            skill_ids = matcher.find(f"{title}\n{text}")
            conn.execute("DELETE FROM vacancy_skills WHERE vacancy_id = %s AND matched_by = 'text'", (vacancy_id,))
            for skill_id in skill_ids:
                conn.execute("""
                    INSERT INTO vacancy_skills (vacancy_id, skill_id, matched_by) VALUES (%s, %s, 'text')
                    ON CONFLICT DO NOTHING""", (vacancy_id, skill_id))
            links += len(skill_ids)
    log.info("поиск навыков: вакансий %d, найдено связей навык—вакансия %d", len(rows), links)
