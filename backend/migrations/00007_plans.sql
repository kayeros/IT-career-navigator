-- Персональный план и библиотека проектов. Имена и поля — строго как в docs/db/schema.sql.

-- +goose Up
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

ALTER TABLE project_topics ADD FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE project_topics ADD FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;
ALTER TABLE plans ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE plans ADD FOREIGN KEY (profession_id) REFERENCES professions(id);
ALTER TABLE plans ADD FOREIGN KEY (current_version_id) REFERENCES plan_versions(id);
ALTER TABLE plan_versions ADD FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;
ALTER TABLE plan_versions ADD FOREIGN KEY (snapshot_id) REFERENCES weight_snapshots(id);
ALTER TABLE plan_versions ADD FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE SET NULL;
ALTER TABLE plan_items ADD FOREIGN KEY (plan_version_id) REFERENCES plan_versions(id) ON DELETE CASCADE;
ALTER TABLE plan_items ADD FOREIGN KEY (topic_id) REFERENCES topics(id);
ALTER TABLE plan_items ADD FOREIGN KEY (project_id) REFERENCES projects(id);

CREATE INDEX ON plan_items (plan_version_id, sort_order);

COMMENT ON COLUMN projects.type IS 'training | pet';
COMMENT ON COLUMN plans.status IS 'active | needs_update | frozen | archived';
COMMENT ON TABLE plans IS 'Количество планов не ограничено';
COMMENT ON COLUMN plan_versions.built_by IS 'ai | algorithm';
COMMENT ON COLUMN plan_items.item_type IS 'topic | project';
COMMENT ON COLUMN plan_items.status IS 'to_learn | known | optional';

-- +goose Down
DROP TABLE IF EXISTS plan_items CASCADE;
DROP TABLE IF EXISTS plan_versions CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS project_topics CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
