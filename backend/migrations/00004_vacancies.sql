-- Вакансии и веса навыков. Имена и поля — строго как в docs/db/schema.sql.

-- +goose Up
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

CREATE INDEX ON vacancies (dedup_hash);
CREATE INDEX ON vacancies (profession_id, published_at);
CREATE INDEX ON vacancy_skills (skill_id);

COMMENT ON COLUMN vacancy_sources.code IS 'superjob | trudvsem | telegram | hh';
COMMENT ON COLUMN import_runs.status IS 'running | ok | failed';
COMMENT ON COLUMN vacancies.experience IS 'none | 1_3';
COMMENT ON COLUMN vacancies.raw_text IS 'храним 12 месяцев';
COMMENT ON COLUMN vacancies.profession_status IS 'auto | review | confirmed';
COMMENT ON COLUMN vacancy_skills.matched_by IS 'key_skills | text';
COMMENT ON COLUMN unknown_terms.status IS 'new | became_skill | became_synonym | ignored';
COMMENT ON COLUMN weight_snapshots.period IS 'первое число месяца';
COMMENT ON COLUMN weight_snapshots.status IS 'draft | published';
COMMENT ON COLUMN skill_weights.weight IS 'доля вакансий с навыком; < 0,05 — не обязательный';
COMMENT ON TABLE unknown_terms IS 'Частые термины без навыка в справочнике → кандидаты в новые навыки';

-- +goose Down
DROP TABLE IF EXISTS skill_weights;
DROP TABLE IF EXISTS weight_snapshots;
DROP TABLE IF EXISTS unknown_terms;
DROP TABLE IF EXISTS vacancy_skills;
DROP TABLE IF EXISTS vacancies;
DROP TABLE IF EXISTS import_runs;
DROP TABLE IF EXISTS vacancy_sources;
