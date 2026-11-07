from collector.skills import SkillMatcher
from collector.superjob import SEARCHES, dedup_hash, parse_vacancy
from collector.weights import compute_weights, salary_median

TERMS = {
    "Java": 1, "джава": 1,
    "JavaScript": 2,
    "Spring": 3, "Spring Boot": 4,
    "PostgreSQL": 5, "postgres": 5, "постгрес": 5,
    "CI/CD": 6, "C#": 7,
    "Тест-кейсы": 8, "test cases": 8,
}


def test_matcher_word_boundaries_and_synonyms():
    m = SkillMatcher(TERMS)
    assert m.find("Ищем Java-разработчика, опыт с Postgres") == {1, 5}
    assert m.find("Frontend на JavaScript") == {2}, "JavaScript не должен засчитываться как Java"
    assert m.find("Знание Spring Boot и Spring Data") == {3, 4}
    assert m.find("Пишем тест-кейсы и TEST CASES") == {8}
    assert m.find("Настройка CI/CD, немного C#") == {6, 7}
    assert m.find("постгресом пользоваться") == set(), "часть слова не считается"
    assert m.find("") == set()


def test_compute_weights():
    weights = compute_weights({1: {10, 20}, 2: {10}, 3: set(), 4: {10}})
    assert weights == {10: 0.75, 20: 0.25}
    assert compute_weights({}) == {}


def test_salary_median():
    assert salary_median([(100, 200), (None, 50), (80, None), (None, None)]) == 80
    assert salary_median([]) is None


def test_parse_superjob_vacancy():
    obj = {
        "id": 123, "profession": " Тестировщик ПО ", "firm_name": "ООО Ромашка",
        "town": {"title": "Уфа"}, "experience": {"id": 1, "title": "Без опыта"},
        "payment_from": 50000, "payment_to": 0, "currency": "rub", "date_published": 1762300800,
        "link": "https://www.superjob.ru/vakansii/123.html",
        "vacancyRichText": "<p>Пишем&nbsp;тест-кейсы</p>", "candidat": "Знание SQL",
    }
    v = parse_vacancy(obj)
    assert v.external_id == "123" and v.title == "Тестировщик ПО" and v.region == "Уфа"
    assert v.experience == "none" and v.salary_from == 50000 and v.salary_to is None
    assert "Пишем тест-кейсы" in v.raw_text and "Знание SQL" in v.raw_text and "<p>" not in v.raw_text
    assert v.published_at.year == 2025
    assert dedup_hash(v) == dedup_hash(parse_vacancy({**obj, "id": 999}))


def test_title_filters():
    assert SEARCHES["java-developer"].title_pattern.search("Junior Java developer")
    assert not SEARCHES["java-developer"].title_pattern.search("JavaScript разработчик")
    assert SEARCHES["qa-manual"].title_pattern.search("Тестировщик")
    assert SEARCHES["qa-manual"].title_pattern.search("Junior QA engineer")
