CREATE TABLE suzy.site_admins (
  nickname_key text COLLATE "C" PRIMARY KEY REFERENCES suzy.accounts (nickname_key) ON DELETE CASCADE
);

CREATE TABLE suzy.site_posts (
  id text COLLATE "C" PRIMARY KEY CHECK (id IN ('news', 'notes')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 70),
  body text NOT NULL CHECK (char_length(body) <= 2500),
  updated_at bigint NOT NULL CHECK (updated_at >= 0),
  updated_by text COLLATE "C" REFERENCES suzy.accounts (nickname_key) ON DELETE SET NULL
);

CREATE INDEX site_posts_updated_by_idx ON suzy.site_posts (updated_by) WHERE updated_by IS NOT NULL;

INSERT INTO suzy.site_posts (id, title, body, updated_at)
VALUES ('news', 'Новости', '', 0), ('notes', 'Заметки', '', 0);

REVOKE ALL ON suzy.site_admins, suzy.site_posts FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE suzy.site_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE suzy.site_posts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON suzy.site_admins, suzy.site_posts TO suzy_app;
GRANT UPDATE (title, body, updated_at, updated_by) ON suzy.site_posts TO suzy_app;

CREATE POLICY suzy_app_reads_site_admins ON suzy.site_admins FOR SELECT TO suzy_app USING (true);
CREATE POLICY suzy_app_reads_site_posts ON suzy.site_posts FOR SELECT TO suzy_app USING (true);
CREATE POLICY suzy_app_updates_site_posts ON suzy.site_posts FOR UPDATE TO suzy_app
  USING (true)
  WITH CHECK (EXISTS (SELECT 1 FROM suzy.site_admins WHERE nickname_key = updated_by));
