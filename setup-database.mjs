import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { databaseOptions } from './src/postgres.mjs';

function scramVerifier(password) {
  // PostgreSQL accepts precomputed SCRAM verifiers, so plaintext never enters SQL logs.
  const iterations = 4096;
  const salt = randomBytes(16);
  const saltedPassword = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const clientKey = createHmac('sha256', saltedPassword).update('Client Key').digest();
  const storedKey = createHash('sha256').update(clientKey).digest('base64');
  const serverKey = createHmac('sha256', saltedPassword).update('Server Key').digest('base64');
  return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${storedKey}:${serverKey}`;
}

async function setup() {
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  if (!adminUrl) throw new Error('Укажи DATABASE_ADMIN_URL в файле .env.setup.');
  const certificatePath = process.env.DATABASE_SSL_ROOT_CERT_FILE;
  const ca = certificatePath ? await readFile(certificatePath, 'utf8') : undefined;
  const options = databaseOptions(adminUrl, ca);
  if (options.user !== 'postgres' && !options.user.startsWith('postgres.')) {
    throw new Error('Для первоначальной настройки используй строку подключения роли postgres.');
  }
  const sql = await readFile(new URL('./supabase/migrations/20261114111520_suzy_accounts.sql', import.meta.url), 'utf8');
  const password = randomBytes(32).toString('base64url');
  const runtimeUrl = new URL(adminUrl);
  runtimeUrl.username = `suzy_app${options.user.slice('postgres'.length)}`;
  runtimeUrl.password = password;

  const admin = new pg.Client({ ...options, connectionTimeoutMillis: 10_000 });
  try {
    await admin.connect();
    await admin.query('BEGIN');
    await admin.query(sql);
    // The verifier contains only the fixed prefix, digits and base64 characters.
    await admin.query(`ALTER ROLE suzy_app LOGIN PASSWORD '${scramVerifier(password)}'`);
    await admin.query('COMMIT');
  } catch (cause) {
    await admin.query('ROLLBACK').catch(() => {});
    throw cause;
  } finally {
    await admin.end();
  }

  console.log('База готова. Скопируй значение после DATABASE_URL= в Render. Не публикуй эту строку.');
  console.log(`DATABASE_URL=${runtimeUrl.href}`);
}

try {
  await setup();
} catch (cause) {
  // Only show the database error code, since driver error messages can include credentials.
  console.error(cause.code ? `Ошибка настройки базы (${cause.code}).` : cause.message);
  process.exitCode = 1;
}
