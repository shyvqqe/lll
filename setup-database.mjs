import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
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

async function promptForConnection() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Запусти npm.cmd run setup:guided в окне PowerShell.');
  }

  let hideInput = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (hideInput) callback();
      else process.stdout.write(chunk, encoding, callback);
    },
  });
  const input = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  input.on('SIGINT', () => input.close());

  try {
    const answer = await input.question('Вставь URI из Supabase → Connect → Session pooler с [YOUR-PASSWORD]: ');
    let url;
    try {
      url = new URL(answer.trim());
    } catch {
      throw new Error('Нужна строка подключения, которая начинается с postgresql://.');
    }
    if (!['postgresql:', 'postgres:'].includes(url.protocol) ||
        !/^[a-z0-9.-]+\.pooler\.supabase\.com$/i.test(url.hostname) || url.port !== '5432' ||
        !/^postgres\.[a-z0-9]+$/i.test(url.username) || url.pathname !== '/postgres') {
      throw new Error('Выбери Session pooler в окне Connect: адрес должен заканчиваться на .pooler.supabase.com, порт — 5432.');
    }
    if (!/^\[YOUR-PASSWORD\]$/i.test(decodeURIComponent(url.password))) {
      throw new Error('Скопируй исходную строку из Supabase с [YOUR-PASSWORD]. Пароль вводится отдельно.');
    }

    process.stdout.write('Пароль базы Supabase (символы скрыты): ');
    hideInput = true;
    const password = await input.question('');
    if (!password) throw new Error('Введи пароль базы, заданный в настройках проекта Supabase.');
    url.password = encodeURIComponent(password);
    return url.href;
  } finally {
    input.close();
    if (hideInput) process.stdout.write('\n');
  }
}

async function setup() {
  const adminUrl = process.argv.includes('--guided') ? await promptForConnection() : process.env.DATABASE_ADMIN_URL;
  if (!adminUrl) throw new Error('Укажи DATABASE_ADMIN_URL в файле .env.setup.');
  const certificatePath = process.env.DATABASE_SSL_ROOT_CERT_FILE;
  const ca = certificatePath ? await readFile(certificatePath, 'utf8') : undefined;
  const options = databaseOptions(adminUrl, ca);
  if (/^(?:POOLER_HOST|\[POOLER-HOST\])$/i.test(options.host) ||
      /PROJECT[_-]REF/i.test(options.user) ||
      /^(?:\[YOUR-PASSWORD\]|YOUR_DATABASE_PASSWORD)$/i.test(options.password)) {
    throw new Error('В .env.setup остался шаблон. Запусти npm.cmd run setup:guided, чтобы ввести строку из Supabase и пароль отдельно.');
  }
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
  if (cause.code === 'ENOTFOUND') {
    console.error('Адрес базы не найден (ENOTFOUND). Скопируй заново всю строку из Supabase → Connect → Session pooler.');
  } else if (cause.code === '28P01') {
    console.error('Supabase отклонил пароль базы (28P01). Проверь пароль и проект, из которого взята строка подключения.');
  } else {
    console.error(cause.code ? `Ошибка настройки базы (${cause.code}).` : cause.message);
  }
  process.exitCode = 1;
}
