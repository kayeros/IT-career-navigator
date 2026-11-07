-- Таблицы аккаунта. Имена и поля — строго как в docs/db/schema.sql.

-- +goose Up
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

ALTER TABLE consents ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE auth_tokens ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE sessions ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

COMMENT ON COLUMN users.role IS 'user | admin';
COMMENT ON COLUMN users.status IS 'active | blocked';
COMMENT ON COLUMN consents.type IS 'pd_processing | marketing | ai_fallback';
COMMENT ON COLUMN auth_tokens.type IS 'email_verify | password_reset';
COMMENT ON COLUMN sessions.revoked_at IS '«выйти со всех устройств»';

-- +goose Down
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS auth_tokens;
DROP TABLE IF EXISTS consents;
DROP TABLE IF EXISTS users;
DROP EXTENSION IF EXISTS citext;
