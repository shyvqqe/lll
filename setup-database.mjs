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
  const upgrade = process.argv.includes('--upgrade');
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
  const baseMigration = new URL('./supabase/migrations/20261114111520_suzy_accounts.sql', import.meta.url);
  const postsMigration = new URL('./supabase/migrations/20261114122724_suzy_site_posts.sql', import.meta.url);
  const runtimePassword = upgrade ? undefined : randomBytes(32).toString('base64url');

  const admin = new pg.Client({ ...options, connectionTimeoutMillis: 10_000 });
  try {
    await admin.connect();
    await admin.query('BEGIN');
    await admin.query('SELECT pg_advisory_xact_lock(1918157002)');
    const { rows: [tables] } = await admin.query(`
      SELECT to_regclass('suzy.accounts') IS NOT NULL AS accounts,
             to_regclass('suzy.site_posts') IS NOT NULL AS posts,
             to_regclass('suzy.site_admins') IS NOT NULL AS admins
    `);
    if (upgrade && !tables.accounts) {
      throw new Error('В этом проекте ещё нет базы suzy. Запусти npm.cmd run setup:guided.');
    }
    if (!upgrade && tables.accounts) {
      throw new Error('База suzy уже настроена. Для обновления запусти npm.cmd run setup:guided -- --upgrade.');
    }
    if (tables.posts !== tables.admins || (!tables.accounts && tables.posts)) {
      throw new Error('Схема публикаций настроена частично. Проверь миграцию в Supabase.');
    }
    if (!upgrade) {
      await admin.query(await readFile(baseMigration, 'utf8'));
      // The verifier contains only the fixed prefix, digits and base64 characters.
      await admin.query(`ALTER ROLE suzy_app LOGIN PASSWORD '${scramVerifier(runtimePassword)}'`);
    }
    if (!tables.posts) await admin.query(await readFile(postsMigration, 'utf8'));
    await admin.query('COMMIT');
  } catch (cause) {
    await admin.query('ROLLBACK').catch(() => {});
    throw cause;
  } finally {
    await admin.end();
  }

  if (upgrade) {
    console.log('База обновлена. Текущий DATABASE_URL на Render по-прежнему подходит.');
  } else {
    const runtimeUrl = new URL(adminUrl);
    runtimeUrl.username = `suzy_app${options.user.slice('postgres'.length)}`;
    runtimeUrl.password = runtimePassword;
    console.log('База готова. Скопируй значение после DATABASE_URL= в Render. Не публикуй эту строку.');
    console.log(`DATABASE_URL=${runtimeUrl.href}`);
  }
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
