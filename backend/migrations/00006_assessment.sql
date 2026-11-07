-- Онбординг и оценка навыков. Имена и поля — строго как в docs/db/schema.sql.

-- +goose Up
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

ALTER TABLE user_profiles ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE check_questions ADD FOREIGN KEY (skill_id) REFERENCES skills(id);
ALTER TABLE assessments ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE assessments ADD FOREIGN KEY (profession_id) REFERENCES professions(id);
ALTER TABLE assessments ADD FOREIGN KEY (snapshot_id) REFERENCES weight_snapshots(id);
ALTER TABLE assessment_answers ADD FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE;
ALTER TABLE assessment_answers ADD FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE;
ALTER TABLE user_skill_levels ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE user_skill_levels ADD FOREIGN KEY (skill_id) REFERENCES skills(id);

CREATE INDEX ON assessments (user_id, profession_id, completed_at);

COMMENT ON COLUMN user_profiles.learner_status IS 'student | graduate | switcher | other';
COMMENT ON COLUMN user_profiles.course IS 'курс, если студент';
COMMENT ON COLUMN user_profiles.hours_per_week IS '2–40';
COMMENT ON COLUMN user_profiles.months_learning IS 'вопрос для гипотез';
COMMENT ON COLUMN user_profiles.learned_unneeded IS '«Было ли, что учили лишнее?»';
COMMENT ON COLUMN assessments.snapshot_id IS 'по каким весам считали';
COMMENT ON COLUMN assessments.status IS 'in_progress | completed';
COMMENT ON TABLE assessments IS 'Отчёт о разрыве считается из оценки и весов, отдельно не хранится';
COMMENT ON COLUMN assessment_answers.self_level IS 'none | basic | confident';
COMMENT ON COLUMN assessment_answers.level IS '0 | 0.5 | 1';
COMMENT ON COLUMN user_skill_levels.source IS 'assessment | progress';
COMMENT ON TABLE user_skill_levels IS 'Общий для всех профессий';

-- +goose Down
DROP TABLE IF EXISTS user_skill_levels CASCADE;
DROP TABLE IF EXISTS assessment_answers CASCADE;
DROP TABLE IF EXISTS assessments CASCADE;
DROP TABLE IF EXISTS check_questions CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
