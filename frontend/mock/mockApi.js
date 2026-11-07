// Мок API среза 1 по api/openapi.yaml: данные в памяти, без сервера.
// Используется демо-страницей (подмена fetch) и локальным мок-сервером (mock/server.mjs).
// Демо-аккаунт demo@example.ru / demo1234 — с ролью admin, чтобы показать админку.

const DAY = 864e5;
const now = () => new Date();
const iso = (d) => d.toISOString();
const isoDate = (d) => d.toISOString().slice(0, 10);

// ---------- справочник ----------
const resources = [
  { id: 5, title: "ISTQB Glossary", url: "https://glossary.istqb.org/", type: "docs", language: "en", is_free: true, status: "approved" },
  { id: 6, title: "Тестирование ПО — курс для начинающих", url: "https://stepik.org/", type: "course", language: "ru", is_free: true, status: "approved" },
  { id: 7, title: "Техники тест-дизайна с примерами", url: "https://habr.com/", type: "article", language: "ru", is_free: true, status: "approved" },
  { id: 8, title: "Jira за 15 минут", url: "https://www.youtube.com/", type: "video", language: "ru", is_free: true, status: "approved" },
  { id: 9, title: "Практикум: тестируем API в Postman", url: "https://www.postman.com/", type: "practice", language: "en", is_free: true, status: "approved" },
  { id: 21, title: "Learn Git Branching", url: "https://learngitbranching.js.org/?locale=ru_RU", type: "practice", language: "ru", is_free: true, status: "approved" },
  { id: 22, title: "SQL-тренажёр", url: "https://sql-academy.org/", type: "practice", language: "ru", is_free: true, status: "approved" },
  { id: 23, title: "Python: документация", url: "https://docs.python.org/3/tutorial/", type: "docs", language: "en", is_free: true, status: "approved" },
  { id: 24, title: "Основы Java — видеокурс", url: "https://www.youtube.com/", type: "video", language: "ru", is_free: true, status: "approved" },
  { id: 25, title: "HTTP для тестировщиков (подборка ИИ)", url: "https://developer.mozilla.org/ru/docs/Web/HTTP", type: "article", language: "ru", is_free: true, status: "ai_suggested" },
].map((r) => ({ replaced_by_id: null, review_comment: null, reviewed_at: null, ...r }));

const skills = [
  [31, "Jira", ["jira", "джира", "atlassian jira"]],
  [32, "Тест-дизайн", ["test design", "техники тест-дизайна"]],
  [33, "SQL", ["sql", "postgresql", "mysql"]],
  [34, "Postman", ["postman"]],
  [35, "Git", ["git", "github", "gitlab"]],
  [36, "DevTools", ["devtools", "chrome devtools"]],
  [37, "Теория тестирования", ["istqb", "теория тестирования"]],
  [38, "Тестовая документация", ["тест-кейсы", "чек-листы", "баг-репорты"]],
  [39, "HTTP", ["http", "rest"]],
  [40, "Python", ["python", "питон"]],
  [41, "Django", ["django"]],
  [42, "Java", ["java", "java core"]],
  [43, "Spring", ["spring", "spring boot"]],
  [44, "Docker", ["docker"]],
].map(([id, name, syn], i) => ({
  id, name, status: "verified", source: "manual", review_comment: null, reviewed_at: null,
  synonyms: syn.map((s, j) => ({ id: id * 10 + j, synonym: s })),
  _i: i,
}));
skills.push({ id: 45, name: "Allure", status: "new", source: "vacancies", review_comment: null, reviewed_at: null, synonyms: [] });
let seq = 1000;
const nextId = () => ++seq;

const topics = [
  [10, "qa-testing-theory", "Теория тестирования", 20, "Цели, принципы, виды и уровни тестирования.", [37], [5, 6]],
  [11, "qa-test-design", "Тест-дизайн", 16, "Классы эквивалентности, граничные значения, таблицы решений.", [32], [7]],
  [12, "qa-docs", "Тестовая документация", 10, "Чек-листы, тест-кейсы и баг-репорты.", [38], []],
  [15, "qa-jira", "Jira и трекеры задач", 4, "Как заводить баги и вести задачи в трекере.", [31], [8]],
  [16, "git", "Git", 8, "Коммиты, ветки и pull request на базовом уровне.", [35], [21]],
  [17, "qa-devtools", "DevTools браузера", 6, "Консоль, вкладка Network, просмотр запросов.", [36], []],
  [18, "http", "HTTP", 8, "Методы, коды ответов, заголовки.", [39, 34], [25]],
  [19, "qa-postman", "Postman", 8, "Ручное тестирование API, коллекции и переменные.", [34], [9]],
  [20, "sql", "SQL", 14, "SELECT, JOIN и фильтры — чтобы проверять данные в базе.", [33], [22]],
  [30, "py-basics", "Основы Python", 30, "Типы данных, условия, циклы, функции.", [40], [23]],
  [31, "py-oop", "ООП в Python", 16, "Классы, наследование, исключения.", [40], [23]],
  [32, "django", "Django", 30, "Модели, представления, шаблоны и админка.", [41], []],
  [33, "docker", "Docker", 10, "Образы, контейнеры и docker compose.", [44], []],
  [40, "java-core", "Java Core", 36, "Синтаксис, коллекции, исключения, ООП.", [42], [24]],
  [41, "spring", "Spring Boot", 30, "Контроллеры, сервисы, Spring Data.", [43], []],
].map(([id, slug, title, hours, description, skill_ids, resource_ids]) => ({ id, slug, title, hours, description, skill_ids, resource_ids }));

const professions = [
  ["qa-manual", "Ручное тестирование (QA)", "Проверяет, что продукт работает как задумано, и находит ошибки до пользователей.", "Тем, кто внимателен к деталям и любит разбираться, как всё устроено.", "available"],
  ["python-dev", "Python-разработчик", "Пишет серверную часть сайтов и сервисов на Python.", "Тем, кому нравится логика и автоматизация.", "available"],
  ["java-dev", "Java-разработчик", "Создаёт надёжные backend-системы для банков и крупных компаний.", "Тем, кто любит строгость и большие системы.", "available"],
  ["frontend", "Frontend-разработчик", "Делает сайты и интерфейсы, которые видит пользователь.", null, "soon"],
  ["backend", "Backend-разработчик", "Пишет серверную часть: данные, логику, API.", null, "soon"],
  ["uxui-designer", "UX/UI-дизайнер", "Проектирует удобные и красивые интерфейсы.", null, "soon"],
  ["data-analyst", "Аналитик данных", "Ищет ответы на вопросы бизнеса в данных.", null, "soon"],
  ["system-analyst", "Системный аналитик", "Переводит задачи бизнеса в требования для разработки.", null, "soon"],
  ["mobile", "Мобильный разработчик", "Делает приложения для iOS и Android.", null, "soon"],
  ["devops", "DevOps-инженер", "Настраивает серверы, сборку и выкладку кода.", null, "soon"],
  ["data-scientist", "Data Scientist", "Строит модели машинного обучения.", null, "soon"],
  ["qa-automation", "Инженер автотестирования", "Пишет код, который сам проверяет продукт.", null, "soon"],
  ["product-manager", "Product-менеджер", "Отвечает за то, что и зачем делает команда.", null, "soon"],
].map(([slug, title, description, for_whom, status], i) => ({ id: i + 1, slug, title, description, for_whom, status, sort_order: i + 1 }));

const B = (profession_id, id, title, sort_order, list) => ({ id, profession_id, title, sort_order, topics: list.map((x) => (Array.isArray(x) ? { topic_id: x[0], optional: x[1] } : { topic_id: x, optional: false })) });
const blocks = [
  B(1, 1, "Основы тестирования", 1, [10, 11, 12]),
  B(1, 2, "Инструменты", 2, [15, 16, 17]),
  B(1, 3, "Веб и API", 3, [18, 19, [20, true]]),
  B(2, 4, "Язык Python", 1, [30, 31]),
  B(2, 5, "Веб-разработка", 2, [18, 32, 20]),
  B(2, 6, "Инструменты", 3, [16, [33, true]]),
  B(3, 7, "Язык Java", 1, [40]),
  B(3, 8, "Backend", 2, [18, 41, 20]),
  B(3, 9, "Инструменты", 3, [16, [33, true]]),
];

// ключевые навыки профессии и их вес в вакансиях (публикует аналитика)
const profSkills = {
  1: [[37, 0.7], [31, 0.6667], [32, 0.62], [38, 0.58], [33, 0.52], [34, 0.41], [39, 0.4], [35, 0.38], [36, 0.33]],
  2: [[40, 0.95], [33, 0.71], [41, 0.55], [39, 0.5], [35, 0.62], [44, 0.42]],
  3: [[42, 0.97], [43, 0.81], [33, 0.66], [35, 0.6], [39, 0.45], [44, 0.38]],
};
const profSkillKey = {}; // `${prof}:${skill}` → is_key (по умолчанию true)

const questions = {
  31: { text: "Что обычно указывают в баг-репорте в Jira обязательно?", options: ["Шаги воспроизведения и ожидаемый результат", "Только скриншот", "Имя разработчика"], correct: 0 },
  32: { text: "Поле принимает возраст от 18 до 60. Какие значения проверить по граничным значениям?", options: ["17, 18, 60, 61", "20, 30, 40", "0 и 100"], correct: 0 },
  33: { text: "Что вернёт SELECT COUNT(*) FROM users?", options: ["Число строк в таблице", "Сумму id", "Первую строку"], correct: 0 },
  35: { text: "Какая команда создаёт новую ветку и переключает на неё?", options: ["git checkout -b feature", "git merge feature", "git push feature"], correct: 0 },
  39: { text: "Что означает код ответа 404?", options: ["Ресурс не найден", "Ошибка сервера", "Успешный запрос"], correct: 0 },
  40: { text: "Что выведет print(len([1, 2, 3]))?", options: ["3", "2", "[1, 2, 3]"], correct: 0 },
  42: { text: "Какой тип в Java хранит целое число?", options: ["int", "String", "boolean"], correct: 0 },
};

const snapshot = { period: "2026-11-01", vacancy_count: 340, calculated_at: "2026-11-05T19:05:02Z", preliminary: false };

const unknownTerms = [
  ["allure", 41, "became_skill", 45], ["swagger", 37, "new"], ["charles", 22, "new"], ["testrail", 19, "new"], ["confluence", 15, "new"], ["кофе", 9, "ignored"], ["постгрес", 7, "new"],
].map(([term, occurrences, status, skill_id = null], i) => ({
  id: 500 + i, term, occurrences, status, skill_id, first_seen_at: "2026-10-12T03:00:00Z", last_seen_at: "2026-11-01T03:00:00Z",
}));

const waitlist = [
  { id: 1, profession_slug: "frontend", email: "anna@example.ru", user_id: null, created_at: "2026-11-03T12:10:00Z" },
  { id: 2, profession_slug: "data-analyst", email: "max@example.ru", user_id: null, created_at: "2026-11-04T08:42:00Z" },
];

// ---------- пользователи и их данные ----------
const emptyProfile = () => ({ learner_status: null, course: null, hours_per_week: null, deadline: null, months_learning: null, learned_unneeded: null, onboarding_completed: false });
const users = new Map([
  ["demo@example.ru", { user: { id: 1, email: "demo@example.ru", name: "Демо", role: "admin", email_verified: false }, pw: "demo1234",
    profile: { ...emptyProfile(), learner_status: "graduate", hours_per_week: 10, onboarding_completed: true }, studied: new Set([10]), assessments: [], plans: {} }],
]);
const byId = (id) => [...users.values()].find((u) => u.user.id === id);

// ---------- вспомогательное ----------
const topicById = (id) => topics.find((t) => t.id === id);
const profBySlug = (slug) => professions.find((p) => p.slug === slug);
const skillById = (id) => skills.find((s) => s.id === id);
const profTopicIds = (pid) => [...new Set(blocks.filter((b) => b.profession_id === pid).sort((a, b) => a.sort_order - b.sort_order).flatMap((b) => b.topics.map((t) => t.topic_id)))];
const optionalIn = (pid, tid) => blocks.some((b) => b.profession_id === pid && b.topics.some((t) => t.topic_id === tid && t.optional));
const keySkills = (pid) => (profSkills[pid] ?? []).filter(([sid]) => profSkillKey[`${pid}:${sid}`] !== false).map(([sid, weight]) => ({ skill: skillById(sid), weight })).filter((x) => x.skill).sort((a, b) => b.weight - a.weight);
const skillTopics = (pid, sid) => profTopicIds(pid).filter((tid) => topicById(tid)?.skill_ids.includes(sid));

function studiedLevel(acc, pid, sid) {
  const ts = skillTopics(pid, sid);
  if (!ts.length) return 0;
  const n = ts.filter((t) => acc.studied.has(t)).length;
  return n === ts.length ? 1 : n > 0 ? 0.5 : 0;
}
function lastCompleted(acc, slug) {
  return acc.assessments.filter((a) => a.profession_slug === slug && a.status === "completed").sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0];
}
function skillLevel(acc, pid, slug, sid) {
  const a = lastCompleted(acc, slug);
  const fromA = a?.answers[sid]?.level ?? 0;
  return Math.max(fromA, studiedLevel(acc, pid, sid));
}
const round1 = (x) => Math.round(x * 10) / 10;
function percentFor(acc, p, levelOf = (sid) => skillLevel(acc, p.id, p.slug, sid)) {
  const ks = keySkills(p.id);
  const sum = ks.reduce((s, k) => s + k.weight, 0);
  if (!sum) return null;
  return round1((ks.reduce((s, k) => s + k.weight * levelOf(k.skill.id), 0) / sum) * 100);
}
function missingList(acc, p) {
  return keySkills(p.id).map((k) => ({ k, level: skillLevel(acc, p.id, p.slug, k.skill.id) })).filter((x) => x.level < 1).map(({ k, level }) => ({
    skill_id: k.skill.id, name: k.skill.name, weight: k.weight, level,
    topics: skillTopics(p.id, k.skill.id).map((tid) => { const t = topicById(tid); return { id: t.id, slug: t.slug, title: t.title, studied: acc.studied.has(t.id) }; }),
  }));
}

function detail(p, acc) {
  const approved = (ids) => ids.map((id) => resources.find((r) => r.id === id)).filter((r) => r && r.status === "approved").map(({ id, title, url, type, language, is_free }) => ({ id, title, url, type, language, is_free }));
  const bl = blocks.filter((b) => b.profession_id === p.id).sort((a, b) => a.sort_order - b.sort_order).map((b) => ({
    id: b.id, title: b.title,
    topics: b.topics.map(({ topic_id, optional }) => { const t = topicById(topic_id); return t && { id: t.id, slug: t.slug, title: t.title, description: t.description, hours: t.hours, optional, studied: !!acc && acc.studied.has(t.id), resources: approved(t.resource_ids) }; }).filter(Boolean),
  }));
  const ids = profTopicIds(p.id);
  return { slug: p.slug, title: p.title, description: p.description, for_whom: p.for_whom, status: p.status, blocks: bl,
    progress: acc ? { studied: ids.filter((i) => acc.studied.has(i)).length, total: ids.length } : null };
}
function summary(p) {
  const ids = profTopicIds(p.id);
  return { slug: p.slug, title: p.title, description: p.description, for_whom: p.for_whom, status: p.status, blocks_count: blocks.filter((b) => b.profession_id === p.id).length, topics_count: ids.length };
}

function assessmentView(a) {
  const p = profBySlug(a.profession_slug);
  return { id: a.id, profession_slug: a.profession_slug, status: a.status, started_at: a.started_at, completed_at: a.completed_at,
    skills: a.skill_ids.map((sid) => {
      const q = questions[sid];
      return { skill_id: sid, name: skillById(sid)?.name ?? "?", question: q ? { id: sid * 100, text: q.text, options: q.options } : null, answer: a.answers[sid] ?? null };
    }).filter(() => p) };
}

function report(acc, p) {
  const missing = missingList(acc, p);
  const ks = keySkills(p.id);
  const levels = ks.map((k) => skillLevel(acc, p.id, p.slug, k.skill.id));
  const a = lastCompleted(acc, p.slug);
  return { percent: percentFor(acc, p), snapshot, assessment: a ? { id: a.id, completed_at: a.completed_at } : null,
    counts: { have: levels.filter((l) => l === 1).length, partial: levels.filter((l) => l === 0.5).length, missing: levels.filter((l) => l === 0).length },
    top_gaps: [...missing].sort((x, y) => y.weight - x.weight).slice(0, 3) };
}

function buildPlan(acc, p, hours, deadline) {
  const ks = keySkills(p.id);
  const items = []; const seen = new Set();
  for (const k of ks) {
    const level = skillLevel(acc, p.id, p.slug, k.skill.id);
    if (level >= 1) continue;
    for (const tid of skillTopics(p.id, k.skill.id)) {
      if (seen.has(tid) || acc.studied.has(tid)) continue;
      seen.add(tid);
      const t = topicById(tid);
      items.push({ topic: { id: t.id, slug: t.slug, title: t.title }, hours: level === 0.5 ? Math.ceil(t.hours / 2) : t.hours,
        status: optionalIn(p.id, tid) ? "optional" : "to_learn",
        skills: t.skill_ids.map((s) => skillById(s)?.name).filter(Boolean) });
    }
  }
  items.sort((a, b) => (a.status === b.status ? 0 : a.status === "optional" ? 1 : -1));
  let acc_h = 0;
  const out = items.map((it, i) => { const week_no = Math.floor(acc_h / hours) + 1; acc_h += it.hours; return { id: nextId(), sort_order: i + 1, week_no, ...it }; });
  const total = out.reduce((s, x) => s + x.hours, 0);
  const created = now();
  const weeks = Math.max(1, Math.ceil(total / hours));
  const ready = new Date(created.getTime() + weeks * 7 * DAY);
  const late = Boolean(deadline) && isoDate(ready) > deadline;
  const daysLeft = deadline ? Math.max(1, (new Date(deadline).getTime() - created.getTime()) / DAY) : 0;
  const prev = acc.plans[p.slug];
  const covered = new Set(ks.map((k) => k.skill.id));
  return {
    id: nextId(), profession_slug: p.slug, version_no: (prev?.version_no ?? 0) + 1, built_by: "algorithm", created_at: iso(created),
    hours_per_week: hours, deadline: deadline || null, total_hours: total, ready_date: isoDate(ready), late,
    hours_per_week_needed: late ? Math.ceil(total / (daysLeft / 7)) : null,
    match_before: percentFor(acc, p) ?? 0, match_after: percentFor(acc, p, (sid) => (covered.has(sid) ? 1 : 0)) ?? 0,
    items: out,
  };
}
function planView(acc, plan) {
  const items = plan.items.map((it) => ({ ...it, studied: acc.studied.has(it.topic.id) }));
  const studiedH = items.filter((i) => i.studied).reduce((s, i) => s + i.hours, 0);
  const cur = items.find((i) => !i.studied);
  return { ...plan, items, current_item_id: cur ? cur.id : null,
    progress: { studied_hours: studiedH, total_hours: plan.total_hours, percent: plan.total_hours ? Math.round((studiedH / plan.total_hours) * 100) : 100 } };
}

const fmtDay = (d) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

// ---------- маршрутизация ----------
const R = (status, body, headers) => ({ status, body, headers });
const E = (status, code, message, extra = {}) => R(status, { error: { code, message, ...extra } });
const NF = () => E(404, "not_found", "Не найдено");
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

/**
 * route(method, path, query, body, session) → {status, body, headers, session?}
 * session — объект { userId } у вызывающей стороны; при входе/выходе возвращаем новое значение.
 */
export function route(method, path, query, body, session) {
  const acc = session?.userId ? byId(session.userId) : null;
  const u = acc?.user;
  const need = () => (u ? null : E(401, "unauthorized", "Войдите в аккаунт"));
  let m;

  // --- аккаунт ---
  if (method === "POST" && path === "/auth/register") {
    const fields = {};
    if (!body.consent_pd) fields.consent_pd = "Нужно согласие на обработку персональных данных";
    if (!String(body.name ?? "").trim()) fields.name = "Укажите имя";
    if (String(body.password ?? "").length < 8) fields.password = "Не короче 8 символов";
    if (Object.keys(fields).length) return E(400, "validation_error", "Проверьте поля формы", { fields });
    const email = String(body.email).toLowerCase();
    if (users.has(email)) return E(409, "email_taken", "Эта почта уже зарегистрирована");
    const user = { id: users.size + 1, email, name: String(body.name).trim(), role: "user", email_verified: false };
    users.set(email, { user, pw: String(body.password), profile: emptyProfile(), studied: new Set(), assessments: [], plans: {} });
    return { ...R(201, user), session: { userId: user.id } };
  }
  if (method === "POST" && path === "/auth/login") {
    const x = users.get(String(body.email ?? "").toLowerCase());
    if (!x || x.pw !== body.password) return E(401, "invalid_credentials", "Неверная почта или пароль");
    return { ...R(200, x.user), session: { userId: x.user.id } };
  }
  if (method === "POST" && path === "/auth/logout") return { ...R(204), session: null };
  if (method === "POST" && path === "/auth/verify-email") {
    if (!body.token || body.token === "bad") return E(400, "invalid_token", "Ссылка неверная или устарела");
    if (u) u.email_verified = true;
    return R(204);
  }
  if (method === "POST" && path === "/auth/verify-email/resend") {
    if (!u) return need();
    if (u.email_verified) return E(409, "already_verified", "Почта уже подтверждена");
    return R(204);
  }
  if (method === "POST" && path === "/auth/password-reset") return R(204);
  if (method === "POST" && path === "/auth/password-reset/confirm") {
    if (!body.token || body.token === "bad") return E(400, "invalid_token", "Ссылка неверная или устарела");
    if (String(body.password ?? "").length < 8) return E(400, "validation_error", "Проверьте поля формы", { fields: { password: "Не короче 8 символов" } });
    const x = users.get("demo@example.ru"); if (x) x.pw = String(body.password);
    return { ...R(204), session: null };
  }
  if (path === "/me") return u ? R(200, u) : need();
  if (path === "/me/profile") {
    if (!u) return need();
    if (method === "PUT") {
      const h = body.hours_per_week;
      if (h != null && (h < 2 || h > 40)) return E(400, "validation_error", "Проверьте поля формы", { fields: { hours_per_week: "От 2 до 40" } });
      Object.assign(acc.profile, pick(body, ["learner_status", "course", "hours_per_week", "deadline", "months_learning", "learned_unneeded"]));
      if (body.complete_onboarding) acc.profile.onboarding_completed = true;
    }
    return R(200, acc.profile);
  }
  if (method === "POST" && path === "/waitlist") {
    const email = u?.email ?? body.email;
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return E(400, "validation_error", "Проверьте почту", { fields: { email: "Проверьте адрес почты" } });
    if (!profBySlug(body.profession_slug)) return NF();
    if (!waitlist.some((w) => w.email === email && w.profession_slug === body.profession_slug))
      waitlist.unshift({ id: nextId(), profession_slug: body.profession_slug, email, user_id: u?.id ?? null, created_at: iso(now()) });
    return R(204);
  }

  // --- каталог ---
  if (path === "/professions") return R(200, { items: professions.filter((p) => p.status !== "hidden").sort((a, b) => a.sort_order - b.sort_order).map(summary) });
  if ((m = /^\/professions\/([^/]+)$/.exec(path))) {
    const p = profBySlug(m[1]);
    return p && p.status === "available" ? R(200, detail(p, acc)) : NF();
  }
  if ((m = /^\/topics\/(\d+)\/progress$/.exec(path))) {
    if (!u) return need();
    if (!topicById(Number(m[1]))) return NF();
    if (method === "PUT") acc.studied.add(Number(m[1])); else acc.studied.delete(Number(m[1]));
    return R(204);
  }

  // --- соответствие, оценка, отчёт, план ---
  if ((m = /^\/professions\/([^/]+)\/(match|assessments|report|plan)$/.exec(path))) {
    if (!u) return need();
    const p = profBySlug(m[1]);
    if (!p || p.status !== "available") return NF();
    if (m[2] === "match") {
      const miss = missingList(acc, p).sort((a, b) => b.weight - a.weight);
      const ks = keySkills(p.id);
      return R(200, { percent: percentFor(acc, p), snapshot, key_skills_total: ks.length, key_skills_covered: ks.length - miss.length, missing: miss.slice(0, 5) });
    }
    if (m[2] === "report") return R(200, report(acc, p));
    if (m[2] === "assessments" && method === "POST") {
      const open = acc.assessments.find((a) => a.profession_slug === p.slug && a.status === "in_progress");
      if (open) return R(200, assessmentView(open));
      const last = lastCompleted(acc, p.slug);
      if (last) {
        const allowed = new Date(new Date(last.completed_at).getTime() + 7 * DAY);
        if (allowed > now()) return E(409, "too_soon", `Пройти оценку заново можно с ${fmtDay(allowed)}. Пока отмечайте изученные темы на карте — процент пересчитается сам.`);
      }
      const a = { id: nextId(), profession_slug: p.slug, status: "in_progress", started_at: iso(now()), completed_at: null, skill_ids: keySkills(p.id).map((k) => k.skill.id), answers: {} };
      acc.assessments.push(a);
      return R(201, assessmentView(a));
    }
    if (m[2] === "plan") {
      if (method === "POST") {
        const hours = body.hours_per_week ?? acc.profile.hours_per_week;
        if (!hours) return E(400, "validation_error", "Укажите, сколько часов в неделю готовы учиться", { fields: { hours_per_week: "От 2 до 40" } });
        if (hours < 2 || hours > 40) return E(400, "validation_error", "Проверьте поля формы", { fields: { hours_per_week: "От 2 до 40" } });
        const plan = buildPlan(acc, p, hours, body.deadline ?? null);
        acc.plans[p.slug] = plan;
        return R(201, planView(acc, plan));
      }
      const plan = acc.plans[p.slug];
      return plan ? R(200, planView(acc, plan)) : E(404, "not_found", "План ещё не построен");
    }
  }
  if ((m = /^\/assessments\/(\d+)(?:\/(answers)\/(\d+)|\/(complete))?$/.exec(path))) {
    if (!u) return need();
    const a = acc.assessments.find((x) => x.id === Number(m[1]));
    if (!a) return NF();
    if (method === "GET" && !m[2] && !m[4]) return R(200, assessmentView(a));
    if (a.status === "completed") return E(409, "completed", "Оценка уже завершена — откройте отчёт");
    if (m[2] && method === "PUT") {
      const sid = Number(m[3]);
      if (!a.skill_ids.includes(sid)) return NF();
      const q = questions[sid];
      const self = body.self_level;
      if (!["none", "basic", "confident"].includes(self)) return E(400, "validation_error", "Выберите вариант", { fields: { self_level: "Выберите вариант" } });
      let level = self === "none" ? 0 : 0.5; let check_passed = null;
      if (self === "confident" && q) {
        if (body.check_option == null) return E(400, "validation_error", "Ответьте на проверочный вопрос", { fields: { check_option: "Выберите ответ" } });
        check_passed = body.check_option === q.correct; level = check_passed ? 1 : 0.5;
      }
      a.answers[sid] = { self_level: self, level, check_passed };
      return R(200, assessmentView(a).skills.find((s) => s.skill_id === sid));
    }
    if (m[4] && method === "POST") {
      a.status = "completed"; a.completed_at = iso(now());
      return R(200, report(acc, profBySlug(a.profession_slug)));
    }
  }

  // --- админка ---
  if (path.startsWith("/admin/")) {
    if (!u) return need();
    if (u.role !== "admin") return E(403, "forbidden", "Нет доступа");
    return admin(method, path.slice(6), query, body);
  }
  return NF();
}

function adminProfession(p) { return { ...p }; }
function adminBlock(b) {
  return { id: b.id, title: b.title, sort_order: b.sort_order,
    topics: b.topics.map(({ topic_id, optional }) => { const t = topicById(topic_id); return t && { id: t.id, slug: t.slug, title: t.title, optional }; }).filter(Boolean) };
}
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function admin(method, path, query, body) {
  let m;
  if (path === "/waitlist") return R(200, waitlist.filter((w) => !query.profession_slug || w.profession_slug === query.profession_slug));
  if (path === "/unknown-terms") return R(200, unknownTerms.filter((t) => !query.status || t.status === query.status).sort((a, b) => b.occurrences - a.occurrences));
  if ((m = /^\/unknown-terms\/(\d+)$/.exec(path)) && method === "PATCH") {
    const t = unknownTerms.find((x) => x.id === Number(m[1])); if (!t) return NF();
    if (body.status === "became_skill") {
      if (skills.some((s) => s.name.toLowerCase() === t.term.toLowerCase())) return E(409, "conflict", "Такой навык уже есть");
      const s = { id: nextId(), name: t.term, status: "new", source: "vacancies", review_comment: null, reviewed_at: null, synonyms: [] };
      skills.push(s); t.skill_id = s.id;
    } else if (body.status === "became_synonym") {
      const s = skillById(body.skill_id); if (!s) return E(400, "validation_error", "Выберите навык", { fields: { skill_id: "Выберите навык" } });
      s.synonyms.push({ id: nextId(), synonym: t.term }); t.skill_id = s.id;
    } else t.skill_id = null;
    t.status = body.status;
    return R(200, t);
  }
  if (path === "/professions") {
    if (method === "POST") {
      if (!SLUG.test(body.slug ?? "")) return E(400, "validation_error", "Проверьте поля", { fields: { slug: "Латиница, цифры и дефисы" } });
      if (profBySlug(body.slug)) return E(409, "conflict", "Такой адрес уже занят");
      const p = { id: nextId(), description: null, for_whom: null, status: "hidden", sort_order: professions.length + 1, ...pick(body, ["slug", "title", "description", "for_whom", "status", "sort_order"]) };
      professions.push(p); profSkills[p.id] = [];
      return R(201, adminProfession(p));
    }
    return R(200, professions.map(adminProfession));
  }
  if ((m = /^\/professions\/(\d+)$/.exec(path)) && method === "PATCH") {
    const p = professions.find((x) => x.id === Number(m[1])); if (!p) return NF();
    if (body.slug && body.slug !== p.slug && profBySlug(body.slug)) return E(409, "conflict", "Такой адрес уже занят");
    Object.assign(p, pick(body, ["slug", "title", "description", "for_whom", "status", "sort_order"]));
    return R(200, adminProfession(p));
  }
  if ((m = /^\/professions\/(\d+)\/blocks$/.exec(path))) {
    const pid = Number(m[1]); if (!professions.some((p) => p.id === pid)) return NF();
    if (method === "POST") { const b = { id: nextId(), profession_id: pid, title: body.title, sort_order: body.sort_order ?? 1, topics: [] }; blocks.push(b); return R(201, adminBlock(b)); }
    return R(200, blocks.filter((b) => b.profession_id === pid).map(adminBlock));
  }
  if ((m = /^\/professions\/(\d+)\/skills$/.exec(path))) {
    const pid = Number(m[1]); if (!professions.some((p) => p.id === pid)) return NF();
    if (method === "PUT") {
      const old = new Map((profSkills[pid] ?? []).map(([sid, w]) => [sid, w]));
      profSkills[pid] = body.map((x) => [x.skill_id, old.get(x.skill_id) ?? 0.3]);
      body.forEach((x) => { profSkillKey[`${pid}:${x.skill_id}`] = x.is_key; });
      return R(204);
    }
    return R(200, (profSkills[pid] ?? []).map(([sid]) => ({ skill_id: sid, name: skillById(sid)?.name ?? "?", is_key: profSkillKey[`${pid}:${sid}`] !== false })));
  }
  if ((m = /^\/blocks\/(\d+)(\/topics)?$/.exec(path))) {
    const b = blocks.find((x) => x.id === Number(m[1])); if (!b) return NF();
    if (m[2] && method === "PUT") { b.topics = body.map((x) => ({ topic_id: x.topic_id, optional: !!x.optional })); return R(204); }
    if (method === "PATCH") { Object.assign(b, pick(body, ["title", "sort_order"])); return R(200, adminBlock(b)); }
    if (method === "DELETE") { blocks.splice(blocks.indexOf(b), 1); return R(204); }
  }
  if (path === "/topics") {
    if (method === "POST") {
      if (!SLUG.test(body.slug ?? "")) return E(400, "validation_error", "Проверьте поля", { fields: { slug: "Латиница, цифры и дефисы" } });
      if (topics.some((t) => t.slug === body.slug)) return E(409, "conflict", "Такой адрес уже занят");
      const t = { id: nextId(), slug: body.slug, title: body.title, description: body.description ?? null, hours: body.hours ?? 0, skill_ids: [], resource_ids: [] };
      topics.push(t); return R(201, t);
    }
    const q = String(query.q ?? "").toLowerCase();
    return R(200, topics.filter((t) => !q || t.title.toLowerCase().includes(q) || t.slug.includes(q)));
  }
  if ((m = /^\/topics\/(\d+)(?:\/(skills|resources))?$/.exec(path))) {
    const t = topicById(Number(m[1])); if (!t) return NF();
    if (m[2] === "skills" && method === "PUT") { t.skill_ids = [...body.ids]; return R(204); }
    if (m[2] === "resources" && method === "PUT") { t.resource_ids = [...body.ids]; return R(204); }
    if (!m[2] && method === "PATCH") { Object.assign(t, pick(body, ["title", "description", "hours"])); return R(200, t); }
  }
  if (path === "/skills") {
    if (method === "POST") {
      if (skills.some((s) => s.name.toLowerCase() === String(body.name).toLowerCase())) return E(409, "conflict", "Такой навык уже есть");
      const s = { id: nextId(), name: body.name, status: body.status ?? "new", source: "manual", review_comment: null, reviewed_at: null, synonyms: [] };
      skills.push(s); return R(201, s);
    }
    return R(200, skills.filter((s) => !query.status || s.status === query.status));
  }
  if ((m = /^\/skills\/(\d+)(\/synonyms)?$/.exec(path))) {
    const s = skillById(Number(m[1])); if (!s) return NF();
    if (m[2] && method === "POST") {
      const syn = String(body.synonym ?? "").trim().toLowerCase();
      if (!syn) return E(400, "validation_error", "Пустой синоним");
      if (skills.some((x) => x.synonyms.some((y) => y.synonym === syn))) return E(409, "conflict", "Такой синоним уже есть");
      const y = { id: nextId(), synonym: syn }; s.synonyms.push(y); return R(201, y);
    }
    if (!m[2] && method === "PATCH") {
      if (body.status && body.status !== s.status) s.reviewed_at = iso(now());
      Object.assign(s, pick(body, ["name", "status", "review_comment"])); return R(200, s);
    }
  }
  if ((m = /^\/synonyms\/(\d+)$/.exec(path)) && method === "DELETE") {
    for (const s of skills) { const i = s.synonyms.findIndex((y) => y.id === Number(m[1])); if (i >= 0) { s.synonyms.splice(i, 1); return R(204); } }
    return NF();
  }
  if (path === "/resources") {
    if (method === "POST") { const r = { id: nextId(), replaced_by_id: null, review_comment: null, reviewed_at: null, status: "approved", ...body }; resources.push(r); return R(201, r); }
    return R(200, resources.filter((r) => !query.status || r.status === query.status));
  }
  if ((m = /^\/resources\/(\d+)$/.exec(path)) && method === "PATCH") {
    const r = resources.find((x) => x.id === Number(m[1])); if (!r) return NF();
    if (body.status && body.status !== r.status) r.reviewed_at = iso(now());
    Object.assign(r, body); return R(200, r);
  }
  return NF();
}
