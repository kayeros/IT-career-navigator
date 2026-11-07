from collector import superjob, trudvsem
from collector.skills import SkillMatcher, extract_terms
from collector.vacancies import SEARCHES, dedup_hash
from collector.weights import compute_weights, salary_median

TERMS = {
    "Java": 1, "джава": 1,
    "JavaScript": 2,
    "Spring": 3, "Spring Boot": 4,
    "PostgreSQL": 5, "postgres": 5, "постгрес": 5,
    "CI/CD": 6, "C#": 7,
    "Тест-кейсы": 8, "test cases": 8,
    "Git": 9,
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
    # Навыки из списка «ключевые навыки» источника
    assert m.find("Навык работы с Git\nНавык работы с JavaScript (JS)") == {9, 2}


def test_matcher_known():
    m = SkillMatcher(TERMS)
    assert m.known("POSTGRES") and m.known("git")
    assert m.known("boot") and m.known("cd"), "части составных навыков (Spring Boot, CI/CD) — не новые термины"
    assert not m.known("kubernetes")


def test_extract_terms():
    terms = extract_terms("Опыт с Kubernetes и k8s, знание GraphQL. Будет плюсом: Allure, team lead, 2024, www.site.ru")
    assert {"kubernetes", "k8s", "graphql", "allure"} <= terms
    assert not terms & {"team", "lead", "2024", "www"}


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
    v = superjob.parse_vacancy(obj)
    assert v.external_id == "123" and v.title == "Тестировщик ПО" and v.region == "Уфа"
    assert v.experience == "none" and v.salary_from == 50000 and v.salary_to is None
    assert "Пишем тест-кейсы" in v.raw_text and "Знание SQL" in v.raw_text and "<p>" not in v.raw_text
    assert v.published_at.year == 2025


def test_parse_trudvsem_vacancy():
    # Поля — как в реальном ответе opendata.trudvsem.ru (контакты в ответе есть, но мы их не берём).
    obj = {
        "id": "6eccbd58-a353", "job-name": "Тестировщик / QA Engineer", "creation-date": "2025-10-07",
        "region": {"name": "Самарская область"}, "company": {"name": "ООО \"СМС-ИТ\"", "email": "hr@x.ru"},
        "salary_min": 50000, "salary_max": 95000, "vac_url": "https://trudvsem.ru/vacancy/card/1/6eccbd58",
        "duty": "Тестирование требований; написание тест-кейсов", "requirements": "SQL",
        "requirement": {"experience": 1}, "skills": ["Навык работы с Git", "Навык работы с Git", "Postman"],
        "contact_list": [{"contact_type": "Телефон", "contact_value": "+7 900"}], "contact_person": "Иванова",
    }
    v = trudvsem.parse_vacancy(obj)
    assert v.title == "Тестировщик / QA Engineer" and v.company == 'ООО "СМС-ИТ"' and v.region == "Самарская область"
    assert v.experience == "1_3" and v.salary_from == 50000 and v.salary_to == 95000
    assert v.key_skills == ["Навык работы с Git", "Postman"], "дубли навыков убираются"
    assert "Иванова" not in v.raw_text and "+7" not in v.raw_text, "контакты не сохраняем"
    assert v.published_at.year == 2025


def test_trudvsem_experience():
    assert trudvsem.experience(0) == "none"
    assert trudvsem.experience(3) == "1_3"
    assert trudvsem.experience(5) is None, "больше 3 лет — не junior"


def test_dedup_hash_across_sources():
    sj = superjob.parse_vacancy({"id": 1, "profession": "Тестировщик ПО", "firm_name": "Ромашка", "town": {"title": "Уфа"}})
    tv = trudvsem.parse_vacancy({"id": "x", "job-name": "тестировщик по", "company": {"name": "ООО «Ромашка»"},
                                 "region": {"name": "Уфа"}})
    assert dedup_hash(sj) == dedup_hash(tv), "одна вакансия из двух источников должна склеиться"


def test_title_filters():
    assert SEARCHES["java-developer"].title_pattern.search("Junior Java developer")
    assert not SEARCHES["java-developer"].title_pattern.search("JavaScript разработчик")
    assert SEARCHES["qa-manual"].title_pattern.search("Тестировщик")
    assert SEARCHES["qa-manual"].title_pattern.search("Junior QA engineer")
