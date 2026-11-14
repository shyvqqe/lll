import { checkJsonWrite, error, getAuthenticatedAccount, json, readJsonBody } from './auth.mjs';

export async function handleContent(request, db, { secureCookies }) {
  const { pathname } = new URL(request.url);

  if (pathname === '/api/content') {
    if (request.method !== 'GET') return error('Метод запроса недоступен.', 405, { Allow: 'GET' });
    const { results } = await db.prepare(`
      SELECT id, title, body FROM suzy.site_posts
      WHERE id IN ('news', 'notes')
      ORDER BY id
    `).all();
    return json({ blocks: results });
  }

  const id = /^\/api\/content\/(news|notes)$/.exec(pathname)?.[1];
  if (!id) return error('Раздел не найден.', 404);
  if (request.method !== 'PUT') return error('Метод запроса недоступен.', 405, { Allow: 'PUT' });

  const invalidWrite = checkJsonWrite(request);
  if (invalidWrite) return invalidWrite;

  const account = await getAuthenticatedAccount(request, db, secureCookies);
  if (!account) return error('Войдите в аккаунт, чтобы продолжить.', 401);
  const forbidden = 'Для редактирования нужны права администратора.';
  if (!account.isAdmin) return error(forbidden, 403);

  const data = await readJsonBody(request, 40 * 1024);
  if (typeof data?.title !== 'string' || typeof data.body !== 'string') {
    return error('Укажите заголовок и текст.', 400);
  }
  const title = data.title.trim();
  const body = data.body.trim();
  const titleLength = [...title].length;
  const bodyLength = [...body].length;
  if (titleLength < 2 || titleLength > 70) return error('Заголовок должен содержать от 2 до 70 символов.', 400);
  if (bodyLength < 1 || bodyLength > 2500) return error('Текст должен содержать от 1 до 2500 символов.', 400);
  if (!title.isWellFormed() || !body.isWellFormed() || title.includes('\0') || body.includes('\0')) {
    return error('Уберите недопустимые символы из заголовка или текста.', 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const block = await db.prepare(`
    UPDATE suzy.site_posts
    SET title = $1, body = $2, updated_at = $3, updated_by = $4
    WHERE id = $5 AND EXISTS (
      SELECT 1 FROM suzy.sessions JOIN suzy.site_admins USING (nickname_key)
      WHERE sessions.token_hash = $6 AND sessions.nickname_key = $4 AND sessions.expires_at > $3
    )
    RETURNING id, title, body
  `).bind(title, body, now, account.nicknameKey, id, account.tokenHash).first();
  if (!block) return error('Обновите страницу и проверьте доступ к разделу.', 403);
  return json({ block });
}
