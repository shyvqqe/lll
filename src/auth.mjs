import { normalizeNickname, validateNickname } from './nickname.mjs';

const encoder = new TextEncoder();
const sessionSeconds = 60 * 60 * 24 * 14;
const attemptWindowSeconds = 60 * 15;
const maxBodyBytes = 4096;

function json(payload, status = 200, extraHeaders = {}) {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

function error(message, status, headers) {
  return json({ error: message }, status, headers);
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomHex(length) {
  return toHex(crypto.getRandomValues(new Uint8Array(length)));
}

async function sha256(text) {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))));
}

async function derivePassword(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bytes = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: encoder.encode(salt),
    iterations,
  }, key, 256);
  return toHex(new Uint8Array(bytes));
}

function hashesMatch(first, second) {
  let difference = first.length ^ second.length;
  for (let index = 0; index < first.length; index++) {
    difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }
  return difference === 0;
}

async function readCredentials(request) {
  if (!request.body) return null;

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const reader = request.body.getReader();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    const data = JSON.parse(text + decoder.decode());
    if (typeof data?.nickname !== 'string' || typeof data.password !== 'string') return null;
    return data;
  } catch {
    await reader.cancel().catch(() => {});
    return null;
  } finally {
    reader.releaseLock();
  }
}

function sessionCookie(name, token, maxAge, secure) {
  const attributes = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
  return `${name}=${token}; ${attributes}${secure ? '; Secure' : ''}`;
}

function readSessionToken(request, name) {
  const cookies = request.headers.get('Cookie') ?? '';
  const cookie = cookies.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  const token = cookie?.slice(name.length + 1);
  return /^[0-9a-f]{64}$/.test(token ?? '') ? token : null;
}

async function useAttempt(db, scope, limit, now) {
  const attempt = await db.prepare(`
    INSERT INTO suzy.auth_attempts (scope, attempts, expires_at) VALUES ($1, 1, $2)
    ON CONFLICT(scope) DO UPDATE SET
      attempts = CASE WHEN auth_attempts.expires_at <= $3 THEN 1 ELSE auth_attempts.attempts + 1 END,
      expires_at = CASE WHEN auth_attempts.expires_at <= $3 THEN $2 ELSE auth_attempts.expires_at END
    WHERE auth_attempts.expires_at <= $3 OR auth_attempts.attempts < $4
    RETURNING attempts
  `).bind(scope, now + attemptWindowSeconds, now, limit).first();
  return attempt !== null;
}

export async function handleApi(request, db, { secureCookies = true, passwordIterations = 100_000 } = {}) {
  const url = new URL(request.url);
  const cookieName = secureCookies ? '__Host-duck_session' : 'duck_session';
  const sessionToken = readSessionToken(request, cookieName);
  const now = Math.floor(Date.now() / 1000);

  if (url.pathname === '/api/session') {
    if (request.method !== 'GET') return error('Метод запроса недоступен.', 405, { Allow: 'GET' });
    if (!sessionToken) return json({ user: null });
    const tokenHash = await sha256(sessionToken);
    const user = await db.prepare(`
      SELECT accounts.nickname
      FROM suzy.sessions JOIN suzy.accounts USING (nickname_key)
      WHERE sessions.token_hash = $1 AND sessions.expires_at > $2
    `).bind(tokenHash, now).first();
    return json({ user });
  }

  const login = url.pathname === '/api/login';
  const register = url.pathname === '/api/register';
  const logout = url.pathname === '/api/logout';
  if (!login && !register && !logout) return error('Страница не найдена.', 404);
  if (request.method !== 'POST') return error('Метод запроса недоступен.', 405, { Allow: 'POST' });
  if (request.headers.get('Origin') !== url.origin) return error('Обновите страницу и повторите попытку.', 403);
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return error('Неверный формат запроса.', 415);
  }

  if (logout) {
    if (sessionToken) {
      await db.prepare('DELETE FROM suzy.sessions WHERE token_hash = $1').bind(await sha256(sessionToken)).run();
    }
    return json({ user: null }, 200, { 'Set-Cookie': sessionCookie(cookieName, '', 0, secureCookies) });
  }

  const data = await readCredentials(request);
  if (!data) return error('Проверьте никнейм и пароль.', 400);
  const parsed = register ? validateNickname(data.nickname) : normalizeNickname(data.nickname);
  const passwordLength = [...data.password].length;
  if (register && parsed.error) return error(parsed.error, 400);
  if (register && (passwordLength < 8 || passwordLength > 128)) {
    return error('Пароль должен содержать от 8 до 128 символов.', 400);
  }

  const invalidLogin = 'Неверный никнейм или пароль.';
  if (login && (parsed.error || passwordLength === 0 || passwordLength > 128)) return error(invalidLogin, 401);

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const ipHash = await sha256(ip);
  const limited = error('Слишком много попыток. Попробуйте через 15 минут.', 429, {
    'Retry-After': String(attemptWindowSeconds),
  });
  if (!await useAttempt(db, `${register ? 'register' : 'login'}:${ipHash}`, register ? 10 : 24, now)) {
    return limited;
  }
  const accountScope = `account:${ipHash}:${parsed.key}`;
  if (login && !await useAttempt(db, accountScope, 8, now)) return limited;

  if (crypto.getRandomValues(new Uint8Array(1))[0] < 16) {
    await db.batch([
      db.prepare('DELETE FROM suzy.sessions WHERE expires_at <= $1').bind(now),
      db.prepare('DELETE FROM suzy.auth_attempts WHERE expires_at <= $1').bind(now),
    ]);
  }

  const statements = [];
  let nickname = parsed.nickname;
  if (register) {
    const salt = randomHex(16);
    const hash = await derivePassword(data.password, salt, passwordIterations);
    statements.push(db.prepare(`
      INSERT INTO suzy.accounts (nickname_key, nickname, password_salt, password_hash, password_iterations, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `).bind(parsed.key, nickname, salt, hash, passwordIterations, now));
  } else {
    const account = await db.prepare(`
      SELECT nickname, password_salt, password_hash, password_iterations FROM suzy.accounts WHERE nickname_key = $1
    `).bind(parsed.key).first();
    const hash = await derivePassword(data.password, account?.password_salt ?? '0'.repeat(32),
      account?.password_iterations ?? passwordIterations);
    if (!hashesMatch(hash, account?.password_hash ?? '0'.repeat(64)) || !account) return error(invalidLogin, 401);
    nickname = account.nickname;
    statements.push(db.prepare('DELETE FROM suzy.auth_attempts WHERE scope = $1').bind(accountScope));
  }

  if (sessionToken) {
    statements.push(db.prepare('DELETE FROM suzy.sessions WHERE token_hash = $1').bind(await sha256(sessionToken)));
  }
  const token = randomHex(32);
  const tokenHash = await sha256(token);
  statements.push(db.prepare(`
    INSERT INTO suzy.sessions (token_hash, nickname_key, expires_at) VALUES ($1, $2, $3)
  `).bind(tokenHash, parsed.key, now + sessionSeconds));
  try {
    await db.batch(statements);
  } catch (cause) {
    if (register && cause?.code === '23505' && cause.constraint === 'accounts_pkey') {
      return error('Этот никнейм уже занят.', 409);
    }
    throw cause;
  }
  return json({ user: { nickname } }, register ? 201 : 200, {
    'Set-Cookie': sessionCookie(cookieName, token, sessionSeconds, secureCookies),
  });
}
