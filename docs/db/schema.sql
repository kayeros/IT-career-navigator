-- Карьерный навигатор IT — схема базы данных (PostgreSQL 16)
-- Сгенерировано из бд_схема.dbml

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email citext NOT NULL UNIQUE,
  email_verified_at timestamptz,
  password_hash text NOT NULL,
  name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE user_profiles (
  user_id bigint PRIMARY KEY,
  learner_status text CHECK (learner_status IN ('student', 'graduate', 'switcher', 'other')),
  course smallint,
  hours_per_week smallint,
  deadline date,
  months_learning smallint,
  learned_unneeded boolean,
  onboarding_completed_at timestamptz,
  notify_weekly boolean NOT NULL DEFAULT true,
  notify_inactive boolean NOT NULL DEFAULT true,
  notify_market boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE consents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL,
  type text NOT NULL CHECK (type IN ('pd_processing', 'marketing', 'ai_fallback')),
  doc_version text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE auth_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL,
  type text NOT NULL CHECK (type IN ('email_verify', 'password_reset')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE sessions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL,
  refresh_token_hash text NOT NULL UNIQUE,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE professions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  for_whom text,
  status text NOT NULL DEFAULT 'soon' CHECK (status IN ('available', 'soon', 'hidden')),
  sort_order int NOT NULL DEFAULT 0,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE blocks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profession_id bigint NOT NULL,
  title text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE topics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  hours numeric(5,1) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE block_topics (
  block_id bigint NOT NULL,
  topic_id bigint NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  optional_for_junior boolean NOT NULL DEFAULT false,
  PRIMARY KEY (block_id, topic_id)
);

CREATE TABLE topic_prerequisites (
  topic_id bigint NOT NULL,
  prerequisite_id bigint NOT NULL,
  PRIMARY KEY (topic_id, prerequisite_id)
);

CREATE TABLE skills (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'verified')),
  source text NOT NULL CHECK (source IN ('vacancies', 'manual')),
  reviewed_by bigint,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE skill_synonyms (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  skill_id bigint NOT NULL,
  synonym citext NOT NULL UNIQUE
);

CREATE TABLE topic_skills (
  topic_id bigint NOT NULL,
  skill_id bigint NOT NULL,
  PRIMARY KEY (topic_id, skill_id)
);

CREATE TABLE profession_skills (
  profession_id bigint NOT NULL,
  skill_id bigint NOT NULL,
  is_key boolean NOT NULL DEFAULT false,
  PRIMARY KEY (profession_id, skill_id)
);

CREATE TABLE resources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  url text NOT NULL,
  type text NOT NULL CHECK (type IN ('article', 'video', 'course', 'docs', 'practice')),
  language text NOT NULL DEFAULT 'ru',
  is_free boolean NOT NULL,
  status text NOT NULL CHECK (status IN ('ai_suggested', 'approved', 'rejected', 'replaced')),
  replaced_by_id bigint,
  link_checked_at timestamptz,
  link_ok boolean,
  reviewed_by bigint,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resource_skills (
  resource_id bigint NOT NULL,
  skill_id bigint NOT NULL,
  PRIMARY KEY (resource_id, skill_id)
);

CREATE TABLE topic_resources (
  topic_id bigint NOT NULL,
  resource_id bigint NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (topic_id, resource_id)
);

CREATE TABLE projects (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('training', 'pet')),
  hours numeric(5,1),
  difficulty smallint
);

CREATE TABLE project_topics (
  project_id bigint NOT NULL,
  topic_id bigint NOT NULL,
  PRIMARY KEY (project_id, topic_id)
);

CREATE TABLE vacancy_sources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code IN ('superjob', 'trudvsem', 'telegram', 'hh')),
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  settings jsonb
);

CREATE TABLE import_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id bigint NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'ok', 'failed')),
  fetched int DEFAULT 0,
  inserted int DEFAULT 0,
  duplicates int DEFAULT 0,
  error text
);

CREATE TABLE vacancies (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id bigint NOT NULL,
  import_run_id bigint,
  external_id text NOT NULL,
  url text,
  title text NOT NULL,
  company text,
  region text,
  experience text CHECK (experience IN ('none', '1_3')),
  salary_from int,
  salary_to int,
  published_at timestamptz,
  raw_text text,
  key_skills_raw jsonb,
  profession_id bigint,
  profession_status text CHECK (profession_status IN ('auto', 'review', 'confirmed')),
  dedup_hash text,
  duplicate_of_id bigint,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id)
);

CREATE TABLE vacancy_skills (
  vacancy_id bigint NOT NULL,
  skill_id bigint NOT NULL,
  matched_by text NOT NULL CHECK (matched_by IN ('key_skills', 'text')),
  PRIMARY KEY (vacancy_id, skill_id)
);

CREATE TABLE unknown_terms (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  term citext NOT NULL UNIQUE,
  occurrences int NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'became_skill', 'became_synonym', 'ignored')),
  skill_id bigint
);

CREATE TABLE weight_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profession_id bigint NOT NULL,
  period date NOT NULL,
  vacancy_count int NOT NULL,
  salary_median int,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  calculated_at timestamptz NOT NULL DEFAULT now(),
  published_by bigint,
  published_at timestamptz,
  UNIQUE (profession_id, period)
);

CREATE TABLE skill_weights (
  snapshot_id bigint NOT NULL,
  skill_id bigint NOT NULL,
  weight numeric(5,4) NOT NULL,
  PRIMARY KEY (snapshot_id, skill_id)
);

CREATE TABLE career_questions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE career_options (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id bigint NOT NULL,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE career_option_scores (
  option_id bigint NOT NULL,
  profession_id bigint NOT NULL,
  points smallint NOT NULL,
  PRIMARY KEY (option_id, profession_id)
);

CREATE TABLE career_results (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL,
  answers jsonb NOT NULL,
  top jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE check_questions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  skill_id bigint NOT NULL,
  question text NOT NULL,
  options jsonb NOT NULL,
  correct_option smallint NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE assessments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL,
  profession_id bigint NOT NULL,
  snapshot_id bigint,
  status text NOT NULL CHECK (status IN ('in_progress', 'completed')),
  match_percent numeric(5,2),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE assessment_answers (
  assessment_id bigint NOT NULL,
  skill_id bigint NOT NULL,
  self_level text NOT NULL CHECK (self_level IN ('none', 'basic', 'confident')),
  check_passed boolean,
  level numeric(2,1) NOT NULL,
  PRIMARY KEY (assessment_id, skill_id)
);

CREATE TABLE user_skill_levels (
  user_id bigint NOT NULL,
  skill_id bigint NOT NULL,
  level numeric(2,1) NOT NULL,
  source text NOT NULL CHECK (source IN ('assessment', 'progress')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE plans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL,
  profession_id bigint NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'needs_update', 'frozen', 'archived')),
  current_version_id bigint,
  hours_per_week smallint NOT NULL,
  deadline date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, profession_id)
);

CREATE TABLE plan_versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plan_id bigint NOT NULL,
  version_no int NOT NULL,
  built_by text NOT NULL CHECK (built_by IN ('ai', 'algorithm')),
  model text,
  prompt_version text,
  snapshot_id bigint,
  assessment_id bigint,
  match_before numeric(5,2),
  match_after numeric(5,2),
  total_hours numeric(6,1),
  ready_date date,
  ai_explanation text,
  ai_raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, version_no)
);

CREATE TABLE plan_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plan_version_id bigint NOT NULL,
  sort_order int NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('topic', 'project')),
  topic_id bigint,
  project_id bigint,
  week_no smallint,
  hours numeric(5,1),
  status text NOT NULL CHECK (status IN ('to_learn', 'known', 'optional')),
  ai_note text
);

CREATE TABLE topic_progress (
  user_id bigint NOT NULL,
  topic_id bigint NOT NULL,
  studied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

CREATE TABLE ai_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint,
  plan_version_id bigint,
  purpose text NOT NULL CHECK (purpose IN ('plan', 'resource_suggest')),
  model text NOT NULL,
  tokens_in int,
  tokens_out int,
  cost_rub numeric(10,4),
  status text NOT NULL CHECK (status IN ('ok', 'error', 'limit')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'active', 'past_due', 'canceled', 'frozen')),
  price_rub int NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  auto_renew boolean NOT NULL DEFAULT true,
  source text NOT NULL CHECK (source IN ('payment', 'promo')),
  promo_code_id bigint,
  provider text,
  provider_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint,
  subscription_id bigint,
  amount_rub int NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  method text CHECK (method IN ('sbp', 'card')),
  provider text NOT NULL,
  provider_payment_id text UNIQUE,
  receipt_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE TABLE promo_codes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code citext NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('percent', 'free_days')),
  value int NOT NULL,
  max_activations int,
  valid_from timestamptz,
  valid_to timestamptz,
  active boolean NOT NULL DEFAULT true,
  comment text
);

CREATE TABLE promo_activations (
  promo_code_id bigint NOT NULL,
  user_id bigint NOT NULL,
  subscription_id bigint,
  activated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (promo_code_id, user_id)
);

CREATE TABLE waitlist (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profession_id bigint NOT NULL,
  email citext NOT NULL,
  user_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  UNIQUE (profession_id, email)
);

CREATE TABLE feedback (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('contact_form', 'resource_report')),
  user_id bigint,
  email citext,
  topic_id bigint,
  resource_id bigint,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ratings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('report', 'plan')),
  assessment_id bigint,
  plan_version_id bigint,
  score smallint NOT NULL,
  learned_new boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE email_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint,
  type text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint,
  session_key text,
  name text NOT NULL,
  props jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id bigint NOT NULL,
  entity text NOT NULL,
  entity_id bigint,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'publish')),
  diff jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Связи
ALTER TABLE user_profiles ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE consents ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE auth_tokens ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE sessions ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE blocks ADD FOREIGN KEY (profession_id) REFERENCES professions(id) ON DELETE CASCADE;
ALTER TABLE block_topics ADD FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE;
ALTER TABLE block_topics ADD FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;
ALTER TABLE topic_prerequisites ADD FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;
ALTER TABLE topic_prerequisites ADD FOREIGN KEY (prerequisite_id) REFERENCES topics(id) ON DELETE CASCADE;
ALTER TABLE skills ADD FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE skill_synonyms ADD FOREIGN KEY (skill_id) REFERENCES skills(id);
ALTER TABLE topic_skills ADD FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;
ALTER TABLE topic_skills ADD FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE;
ALTER TABLE profession_skills ADD FOREIGN KEY (profession_id) REFERENCES professions(id) ON DELETE CASCADE;
ALTER TABLE profession_skills ADD FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE;
ALTER TABLE resources ADD FOREIGN KEY (replaced_by_id) REFERENCES resources(id);
ALTER TABLE resources ADD FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE resource_skills ADD FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;
ALTER TABLE resource_skills ADD FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE;
ALTER TABLE topic_resources ADD FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;
ALTER TABLE topic_resources ADD FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;
ALTER TABLE project_topics ADD FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE project_topics ADD FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;
ALTER TABLE import_runs ADD FOREIGN KEY (source_id) REFERENCES vacancy_sources(id);
ALTER TABLE vacancies ADD FOREIGN KEY (source_id) REFERENCES vacancy_sources(id);
ALTER TABLE vacancies ADD FOREIGN KEY (import_run_id) REFERENCES import_runs(id);
ALTER TABLE vacancies ADD FOREIGN KEY (profession_id) REFERENCES professions(id);
ALTER TABLE vacancies ADD FOREIGN KEY (duplicate_of_id) REFERENCES vacancies(id);
ALTER TABLE vacancy_skills ADD FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE CASCADE;
ALTER TABLE vacancy_skills ADD FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE;
ALTER TABLE unknown_terms ADD FOREIGN KEY (skill_id) REFERENCES skills(id);
ALTER TABLE weight_snapshots ADD FOREIGN KEY (profession_id) REFERENCES professions(id);
ALTER TABLE weight_snapshots ADD FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE skill_weights ADD FOREIGN KEY (snapshot_id) REFERENCES weight_snapshots(id) ON DELETE CASCADE;
ALTER TABLE skill_weights ADD FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE;
ALTER TABLE career_options ADD FOREIGN KEY (question_id) REFERENCES career_questions(id) ON DELETE CASCADE;
ALTER TABLE career_option_scores ADD FOREIGN KEY (option_id) REFERENCES career_options(id) ON DELETE CASCADE;
ALTER TABLE career_option_scores ADD FOREIGN KEY (profession_id) REFERENCES professions(id) ON DELETE CASCADE;
ALTER TABLE career_results ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE check_questions ADD FOREIGN KEY (skill_id) REFERENCES skills(id);
ALTER TABLE assessments ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE assessments ADD FOREIGN KEY (profession_id) REFERENCES professions(id);
ALTER TABLE assessments ADD FOREIGN KEY (snapshot_id) REFERENCES weight_snapshots(id);
ALTER TABLE assessment_answers ADD FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE;
ALTER TABLE assessment_answers ADD FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE;
ALTER TABLE user_skill_levels ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE user_skill_levels ADD FOREIGN KEY (skill_id) REFERENCES skills(id);
ALTER TABLE plans ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE plans ADD FOREIGN KEY (profession_id) REFERENCES professions(id);
ALTER TABLE plans ADD FOREIGN KEY (current_version_id) REFERENCES plan_versions(id);
ALTER TABLE plan_versions ADD FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;
ALTER TABLE plan_versions ADD FOREIGN KEY (snapshot_id) REFERENCES weight_snapshots(id);
ALTER TABLE plan_versions ADD FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE SET NULL;
ALTER TABLE plan_items ADD FOREIGN KEY (plan_version_id) REFERENCES plan_versions(id) ON DELETE CASCADE;
ALTER TABLE plan_items ADD FOREIGN KEY (topic_id) REFERENCES topics(id);
ALTER TABLE plan_items ADD FOREIGN KEY (project_id) REFERENCES projects(id);
ALTER TABLE topic_progress ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE topic_progress ADD FOREIGN KEY (topic_id) REFERENCES topics(id);
ALTER TABLE ai_requests ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ai_requests ADD FOREIGN KEY (plan_version_id) REFERENCES plan_versions(id) ON DELETE SET NULL;
ALTER TABLE subscriptions ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE subscriptions ADD FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id);
ALTER TABLE payments ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE payments ADD FOREIGN KEY (subscription_id) REFERENCES subscriptions(id);
ALTER TABLE promo_activations ADD FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE CASCADE;
ALTER TABLE promo_activations ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE promo_activations ADD FOREIGN KEY (subscription_id) REFERENCES subscriptions(id);
ALTER TABLE waitlist ADD FOREIGN KEY (profession_id) REFERENCES professions(id);
ALTER TABLE waitlist ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE feedback ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE feedback ADD FOREIGN KEY (topic_id) REFERENCES topics(id);
ALTER TABLE feedback ADD FOREIGN KEY (resource_id) REFERENCES resources(id);
ALTER TABLE ratings ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ratings ADD FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE SET NULL;
ALTER TABLE ratings ADD FOREIGN KEY (plan_version_id) REFERENCES plan_versions(id) ON DELETE SET NULL;
ALTER TABLE email_log ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE events ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE audit_log ADD FOREIGN KEY (admin_id) REFERENCES users(id);

-- Индексы
CREATE INDEX ON block_topics (topic_id);
CREATE INDEX ON topic_skills (skill_id);
CREATE INDEX ON profession_skills (skill_id);
CREATE INDEX ON resource_skills (skill_id);
CREATE INDEX ON vacancies (dedup_hash);
CREATE INDEX ON vacancies (profession_id, published_at);
CREATE INDEX ON vacancy_skills (skill_id);
CREATE INDEX ON assessments (user_id, profession_id, completed_at);
CREATE INDEX ON plan_items (plan_version_id, sort_order);
CREATE INDEX ON ai_requests (user_id, created_at);
CREATE INDEX ON subscriptions (user_id, status);
CREATE INDEX ON events (name, created_at);

-- Пояснения
COMMENT ON COLUMN users.role IS 'user | admin';
COMMENT ON COLUMN users.status IS 'active | blocked';
COMMENT ON COLUMN user_profiles.learner_status IS 'student | graduate | switcher | other';
COMMENT ON COLUMN user_profiles.course IS 'курс, если студент';
COMMENT ON COLUMN user_profiles.hours_per_week IS '2–40';
COMMENT ON COLUMN user_profiles.months_learning IS 'вопрос для гипотез';
COMMENT ON COLUMN user_profiles.learned_unneeded IS '«Было ли, что учили лишнее?»';
COMMENT ON COLUMN consents.type IS 'pd_processing | marketing | ai_fallback';
COMMENT ON COLUMN auth_tokens.type IS 'email_verify | password_reset';
COMMENT ON COLUMN sessions.revoked_at IS '«выйти со всех устройств»';
COMMENT ON COLUMN professions.for_whom IS '«кому подходит»';
COMMENT ON COLUMN professions.status IS 'available | soon | hidden';
COMMENT ON COLUMN topics.hours IS 'часы с нуля';
COMMENT ON TABLE topics IS 'Общая библиотека тем: Git, SQL, HTTP пишутся один раз';
COMMENT ON COLUMN skills.status IS 'new | in_review | verified (раздел 9.1)';
COMMENT ON COLUMN skills.source IS 'vacancies | manual';
COMMENT ON COLUMN skill_synonyms.synonym IS 'JS, JavaScript, ЯваСкрипт → один навык';
COMMENT ON COLUMN profession_skills.is_key IS 'участвует в оценке навыков (15–25 на профессию)';
COMMENT ON COLUMN resources.type IS 'article | video | course | docs | practice';
COMMENT ON COLUMN resources.status IS 'ai_suggested | approved | rejected | replaced';
COMMENT ON TABLE resources IS 'Пользователь видит только approved';
COMMENT ON COLUMN projects.type IS 'training | pet';
COMMENT ON COLUMN vacancy_sources.code IS 'superjob | trudvsem | telegram | hh';
COMMENT ON COLUMN import_runs.status IS 'running | ok | failed';
COMMENT ON COLUMN vacancies.experience IS 'none | 1_3';
COMMENT ON COLUMN vacancies.raw_text IS 'храним 12 месяцев';
COMMENT ON COLUMN vacancies.profession_status IS 'auto | review | confirmed';
COMMENT ON COLUMN vacancy_skills.matched_by IS 'key_skills | text';
COMMENT ON COLUMN unknown_terms.status IS 'new | became_skill | became_synonym | ignored';
COMMENT ON TABLE unknown_terms IS 'Частые термины без навыка в справочнике → кандидаты в новые навыки';
COMMENT ON COLUMN weight_snapshots.period IS 'первое число месяца';
COMMENT ON COLUMN weight_snapshots.status IS 'draft | published';
COMMENT ON COLUMN skill_weights.weight IS 'доля вакансий с навыком; < 0,05 — не обязательный';
COMMENT ON TABLE career_option_scores IS 'Баллы скрыты от пользователя';
COMMENT ON COLUMN career_results.answers IS 'id выбранных вариантов';
COMMENT ON COLUMN career_results.top IS '[{profession_id, percent, reasons}] — топ-3';
COMMENT ON COLUMN assessments.snapshot_id IS 'по каким весам считали';
COMMENT ON COLUMN assessments.status IS 'in_progress | completed';
COMMENT ON TABLE assessments IS 'Отчёт о разрыве считается из оценки и весов, отдельно не хранится';
COMMENT ON COLUMN assessment_answers.self_level IS 'none | basic | confident';
COMMENT ON COLUMN assessment_answers.level IS '0 | 0.5 | 1';
COMMENT ON COLUMN user_skill_levels.source IS 'assessment | progress';
COMMENT ON TABLE user_skill_levels IS 'Общий для всех профессий';
COMMENT ON COLUMN plans.status IS 'active | needs_update | frozen | archived';
COMMENT ON TABLE plans IS 'Количество планов не ограничено';
COMMENT ON COLUMN plan_versions.built_by IS 'ai | algorithm';
COMMENT ON COLUMN plan_items.item_type IS 'topic | project';
COMMENT ON COLUMN plan_items.status IS 'to_learn | known | optional';
COMMENT ON TABLE topic_progress IS '«Изучено» — общее для базового roadmap и всех планов';
COMMENT ON COLUMN ai_requests.purpose IS 'plan | resource_suggest';
COMMENT ON COLUMN ai_requests.status IS 'ok | error | limit';
COMMENT ON TABLE ai_requests IS 'Дневной лимит и расчёт стоимости ИИ';
COMMENT ON COLUMN subscriptions.status IS 'pending | active | past_due | canceled | frozen';
COMMENT ON COLUMN subscriptions.source IS 'payment | promo';
COMMENT ON COLUMN payments.user_id IS 'обнуляется при удалении аккаунта';
COMMENT ON COLUMN payments.status IS 'pending | succeeded | failed | refunded';
COMMENT ON COLUMN payments.method IS 'sbp | card';
COMMENT ON COLUMN promo_codes.type IS 'percent | free_days';
COMMENT ON TABLE promo_codes IS 'Временное решение для пилота';
COMMENT ON TABLE waitlist IS '«Сообщить о запуске»';
COMMENT ON COLUMN feedback.type IS 'contact_form | resource_report';
COMMENT ON COLUMN feedback.status IS 'new | in_progress | closed';
COMMENT ON COLUMN ratings.target_type IS 'report | plan';
COMMENT ON COLUMN ratings.score IS '1–5';
COMMENT ON COLUMN ratings.learned_new IS '«Узнали что-то новое?»';
COMMENT ON COLUMN email_log.status IS 'sent | failed';
COMMENT ON TABLE events IS 'События аналитики; партиционирование по месяцам';
COMMENT ON COLUMN audit_log.action IS 'create | update | delete | publish';
COMMENT ON TABLE settings IS 'Цена подписки, лимиты ИИ, тексты писем';
