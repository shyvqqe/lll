-- Application connections use this private schema via PostgreSQL. Keep it out of the Data API.
CREATE SCHEMA suzy;
CREATE ROLE suzy_app NOLOGIN NOCREATEROLE NOCREATEDB NOINHERIT NOREPLICATION NOBYPASSRLS;

REVOKE ALL ON SCHEMA suzy FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE suzy.accounts (
  nickname_key text COLLATE "C" PRIMARY KEY CHECK (char_length(nickname_key) BETWEEN 4 AND 25),
  nickname text NOT NULL CHECK (char_length(nickname) BETWEEN 4 AND 25),
  password_salt text NOT NULL CHECK (password_salt COLLATE "C" ~ '^[0-9a-f]{32}$'),
  password_hash text NOT NULL CHECK (password_hash COLLATE "C" ~ '^[0-9a-f]{64}$'),
  password_iterations integer NOT NULL CHECK (password_iterations > 0),
  created_at bigint NOT NULL CHECK (created_at >= 0)
);

CREATE TABLE suzy.sessions (
  token_hash text COLLATE "C" PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  nickname_key text COLLATE "C" NOT NULL REFERENCES suzy.accounts (nickname_key) ON DELETE CASCADE,
  expires_at bigint NOT NULL CHECK (expires_at >= 0)
);

CREATE INDEX sessions_nickname_key_idx ON suzy.sessions (nickname_key);
CREATE INDEX sessions_expires_at_idx ON suzy.sessions (expires_at);

CREATE TABLE suzy.auth_attempts (
  scope text COLLATE "C" PRIMARY KEY,
  attempts integer NOT NULL CHECK (attempts > 0),
  expires_at bigint NOT NULL CHECK (expires_at >= 0)
);

CREATE INDEX auth_attempts_expires_at_idx ON suzy.auth_attempts (expires_at);

REVOKE ALL ON ALL TABLES IN SCHEMA suzy FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE suzy.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE suzy.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suzy.auth_attempts ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA suzy TO suzy_app;
GRANT INSERT, SELECT (nickname_key, nickname, password_salt, password_hash, password_iterations)
  ON suzy.accounts TO suzy_app;
GRANT SELECT, INSERT, DELETE ON suzy.sessions TO suzy_app;
GRANT SELECT, INSERT, DELETE, UPDATE (attempts, expires_at) ON suzy.auth_attempts TO suzy_app;

CREATE POLICY suzy_app_accounts ON suzy.accounts TO suzy_app USING (true) WITH CHECK (true);
CREATE POLICY suzy_app_sessions ON suzy.sessions TO suzy_app USING (true) WITH CHECK (true);
CREATE POLICY suzy_app_auth_attempts ON suzy.auth_attempts TO suzy_app USING (true) WITH CHECK (true);

