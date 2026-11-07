-- Лист ожидания «Сообщить о запуске». Имена и поля — строго как в docs/db/schema.sql.

-- +goose Up
CREATE TABLE waitlist (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profession_id bigint NOT NULL,
  email citext NOT NULL,
  user_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  UNIQUE (profession_id, email)
);

ALTER TABLE waitlist ADD FOREIGN KEY (profession_id) REFERENCES professions(id);
ALTER TABLE waitlist ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

COMMENT ON TABLE waitlist IS '«Сообщить о запуске»';

-- +goose Down
DROP TABLE IF EXISTS waitlist CASCADE;
