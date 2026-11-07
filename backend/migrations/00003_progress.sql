-- Прогресс пользователя. Имена и поля — строго как в docs/db/schema.sql.

-- +goose Up
CREATE TABLE topic_progress (
  user_id bigint NOT NULL,
  topic_id bigint NOT NULL,
  studied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

ALTER TABLE topic_progress ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE topic_progress ADD FOREIGN KEY (topic_id) REFERENCES topics(id);

COMMENT ON TABLE topic_progress IS '«Изучено» — общее для базового roadmap и всех планов';

-- +goose Down
DROP TABLE IF EXISTS topic_progress;
