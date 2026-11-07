"""Поиск навыков в вакансиях по справочнику skills и синонимам skill_synonyms. Без языковой модели.

Навык, найденный в списке ключевых навыков источника, помечается matched_by = key_skills,
найденный только в тексте вакансии — matched_by = text.
"""

import logging
import re
from collections import Counter

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
        # Слова из составных терминов: «api» из «REST API», «ci» из «CI/CD», «boot» из «Spring Boot».
        self._parts = {w for t in terms for w in re.split(r"[^\w+#]+", t.lower()) if w}

    def known(self, term: str) -> bool:
        """Есть ли термин в справочнике — целиком или как часть составного навыка."""
        return term.lower() in self._parts

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
        SELECT id, title, coalesce(raw_text, ''), coalesce(key_skills_raw, '[]'::jsonb) FROM vacancies
        WHERE profession_id IS NOT NULL AND duplicate_of_id IS NULL""").fetchall()

    links = 0
    with conn.transaction():
        for vacancy_id, title, text, key_skills in rows:
            by_key = matcher.find("\n".join(str(s) for s in key_skills))
            by_text = matcher.find(f"{title}\n{text}") - by_key
            conn.execute("DELETE FROM vacancy_skills WHERE vacancy_id = %s", (vacancy_id,))
            for skill_id, how in [(s, "key_skills") for s in by_key] + [(s, "text") for s in by_text]:
                conn.execute("""
                    INSERT INTO vacancy_skills (vacancy_id, skill_id, matched_by) VALUES (%s, %s, %s)
                    ON CONFLICT DO NOTHING""", (vacancy_id, skill_id, how))
            links += len(by_key) + len(by_text)
    log.info("поиск навыков: вакансий %d, найдено связей навык—вакансия %d", len(rows), links)


# ---------- частые неизвестные термины ----------

# Технические термины в вакансиях почти всегда латиницей: Kubernetes, GraphQL, Allure, k8s.
_TERM = re.compile(r"(?<![\w.+#-])[a-z][a-z0-9+#.\-]{1,29}(?![\w+#])", re.I)

# Латинские слова, которые не являются навыками.
STOP_WORDS = {
    "and", "or", "the", "of", "in", "on", "for", "to", "with", "a", "an", "is", "be", "it", "we", "you", "our", "your",
    "it-", "it", "hr", "ceo", "cto", "pm", "id", "ip", "ok", "etc", "e.g", "i.e", "vs", "pro", "team", "lead", "junior",
    "middle", "senior", "intern", "developer", "engineer", "qa", "remote", "office", "full", "time", "part", "job",
    "work", "skills", "experience", "knowledge", "development", "company", "project", "projects", "web", "online",
    "www", "http", "https", "com", "ru", "rf", "inn", "ooo", "llc", "ltd", "inc", "dms", "hh", "telegram", "whatsapp",
    "backend", "frontend", "fullstack", "data", "database", "mobile", "desktop", "server", "client", "software",
}

# Сколько вакансий должно упомянуть термин, чтобы он попал на ручной разбор.
MIN_VACANCIES = 3


def extract_terms(text: str) -> set[str]:
    """Кандидаты в новые навыки из текста: латинские слова, без стоп-слов и чисел."""
    out = set()
    for m in _TERM.finditer(text):
        t = m.group(0).strip(".-").lower()
        if len(t) >= 2 and t not in STOP_WORDS and not t.isdigit():
            out.add(t)
    return out


def unknown_terms(conn: psycopg.Connection) -> None:
    """Копит в unknown_terms частые термины, которых нет в справочнике навыков, — для ручного разбора."""
    matcher = load_matcher(conn)
    counts: Counter[str] = Counter()
    for title, text, key_skills in conn.execute("""
            SELECT title, coalesce(raw_text, ''), coalesce(key_skills_raw, '[]'::jsonb) FROM vacancies
            WHERE duplicate_of_id IS NULL"""):
        terms = extract_terms(f"{title}\n{text}\n" + "\n".join(str(s) for s in key_skills))
        counts.update(t for t in terms if not matcher.known(t))

    frequent = {t: n for t, n in counts.items() if n >= MIN_VACANCIES}
    with conn.transaction():
        for term, n in frequent.items():
            # Статус (разобран ли термин) не трогаем — обновляем только частоту и дату.
            conn.execute("""
                INSERT INTO unknown_terms (term, occurrences) VALUES (%s, %s)
                ON CONFLICT (term) DO UPDATE SET occurrences = EXCLUDED.occurrences, last_seen_at = now()""",
                         (term, n))
    log.info("неизвестные термины: кандидатов %d (встречаются в %d+ вакансиях)", len(frequent), MIN_VACANCIES)
