-- Таблицы контента. Имена и поля — строго как в docs/db/schema.sql.

-- +goose Up
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

CREATE TABLE topic_resources (
  topic_id bigint NOT NULL,
  resource_id bigint NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (topic_id, resource_id)
);

ALTER TABLE blocks ADD FOREIGN KEY (profession_id) REFERENCES professions(id) ON DELETE CASCADE;
ALTER TABLE block_topics ADD FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE;
ALTER TABLE block_topics ADD FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;
ALTER TABLE skills ADD FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE skill_synonyms ADD FOREIGN KEY (skill_id) REFERENCES skills(id);
ALTER TABLE topic_skills ADD FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;
ALTER TABLE topic_skills ADD FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE;
ALTER TABLE profession_skills ADD FOREIGN KEY (profession_id) REFERENCES professions(id) ON DELETE CASCADE;
ALTER TABLE profession_skills ADD FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE;
ALTER TABLE resources ADD FOREIGN KEY (replaced_by_id) REFERENCES resources(id);
ALTER TABLE resources ADD FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE topic_resources ADD FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;
ALTER TABLE topic_resources ADD FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;

CREATE INDEX ON block_topics (topic_id);
CREATE INDEX ON topic_skills (skill_id);
CREATE INDEX ON profession_skills (skill_id);

COMMENT ON COLUMN professions.for_whom IS '«кому подходит»';
COMMENT ON COLUMN professions.status IS 'available | soon | hidden';
COMMENT ON COLUMN topics.hours IS 'часы с нуля';
COMMENT ON COLUMN skills.status IS 'new | in_review | verified (раздел 9.1)';
COMMENT ON COLUMN skills.source IS 'vacancies | manual';
COMMENT ON COLUMN skill_synonyms.synonym IS 'JS, JavaScript, ЯваСкрипт → один навык';
COMMENT ON COLUMN profession_skills.is_key IS 'участвует в оценке навыков (15–25 на профессию)';
COMMENT ON COLUMN resources.type IS 'article | video | course | docs | practice';
COMMENT ON COLUMN resources.status IS 'ai_suggested | approved | rejected | replaced';
COMMENT ON TABLE topics IS 'Общая библиотека тем: Git, SQL, HTTP пишутся один раз';
COMMENT ON TABLE resources IS 'Пользователь видит только approved';

-- +goose Down
DROP TABLE IF EXISTS topic_resources;
DROP TABLE IF EXISTS resources;
DROP TABLE IF EXISTS profession_skills;
DROP TABLE IF EXISTS topic_skills;
DROP TABLE IF EXISTS skill_synonyms;
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS block_topics;
DROP TABLE IF EXISTS topics;
DROP TABLE IF EXISTS blocks;
DROP TABLE IF EXISTS professions;
