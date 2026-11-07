-- Журнал изменений админки. Имена и поля — строго как в docs/db/schema.sql.

-- +goose Up
CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id bigint NOT NULL,
  entity text NOT NULL,
  entity_id bigint,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'publish')),
  diff jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ADD FOREIGN KEY (admin_id) REFERENCES users(id);

COMMENT ON COLUMN audit_log.action IS 'create | update | delete | publish';

-- +goose Down
DROP TABLE IF EXISTS audit_log CASCADE;
