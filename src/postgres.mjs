import { readFileSync } from 'node:fs';
import { checkServerIdentity } from 'node:tls';
import pg from 'pg';

// Supabase Studio's published production root certificate. Scope trust to its shared pooler.
const supabasePoolerHost = /^[a-z0-9-]+\.pooler\.supabase\.(?:com|co)$/i;
const supabaseRootCertificate = new URL('../certs/prod-ca-2021.crt', import.meta.url);

export function databaseOptions(connectionString, rootCertificate) {
  if (!connectionString) throw new Error('DATABASE_URL is required.');

  let settings;
  try {
    const url = new URL(connectionString);
    if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname || !url.username ||
      !url.password || !/^\/[^/]+$/.test(url.pathname) || url.hash) {
      throw new Error();
    }
    for (const [key, value] of url.searchParams) {
      if (key !== 'sslmode' || value !== 'verify-full') throw new Error();
    }
    settings = {
      host: url.hostname.replace(/^\[|\]$/g, ''),
      port: Number(url.port || 5432),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
    };
    if (settings.port < 1 || settings.port > 65535) throw new Error();
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL URL with credentials and database name. Use no query parameters or sslmode=verify-full.');
  }

  const ca = rootCertificate?.trim() || (supabasePoolerHost.test(settings.host)
    ? readFileSync(supabaseRootCertificate, 'utf8')
    : undefined);
  return {
    ...settings,
    ssl: {
      rejectUnauthorized: true,
      ...(ca ? { ca } : {}),
      checkServerIdentity: (_name, cert) => checkServerIdentity(settings.host, cert),
    },
  };
}

export function createPostgresPool(connectionString, rootCertificate) {
  return new pg.Pool({
    ...databaseOptions(connectionString, rootCertificate),
    max: 5,
    connectionTimeoutMillis: 4_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 4_000,
  });
}

export function createPostgresAdapter(pool) {
  const queries = new WeakMap();

  function prepare(sql, values = []) {
    const query = { text: sql, values };
    const statement = {
      bind(...parameters) {
        return prepare(sql, parameters);
      },
      async first() {
        const result = await pool.query(query);
        return result.rows[0] ?? null;
      },
      async all() {
        const result = await pool.query(query);
        return { results: result.rows };
      },
      async run() {
        const result = await pool.query(query);
        return { success: true, meta: { changes: result.rowCount } };
      },
    };
    queries.set(statement, query);
    return statement;
  }

  return {
    prepare,
    async batch(statements) {
      const client = await pool.connect();
      let discardClient = false;
      try {
        await client.query('BEGIN');
        for (const statement of statements) {
          const query = queries.get(statement);
          if (!query) throw new TypeError('Expected a statement prepared by this adapter.');
          await client.query(query);
        }
        await client.query('COMMIT');
      } catch (cause) {
        try {
          await client.query('ROLLBACK');
        } catch {
          discardClient = true;
        }
        throw cause;
      } finally {
        client.release(discardClient);
      }
    },
    async checkHealth() {
      await pool.query(`
        SELECT EXISTS (SELECT 1 FROM suzy.accounts WHERE nickname_key IS NOT NULL),
               EXISTS (SELECT 1 FROM suzy.sessions WHERE token_hash IS NOT NULL),
               EXISTS (SELECT 1 FROM suzy.auth_attempts WHERE scope IS NOT NULL),
               EXISTS (SELECT 1 FROM suzy.site_admins WHERE nickname_key IS NOT NULL),
               EXISTS (SELECT 1 FROM suzy.site_posts WHERE id IN ('news', 'notes'))
      `);
    },
  };
}
