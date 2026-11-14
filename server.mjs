import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createPostgresAdapter, createPostgresPool } from './src/postgres.mjs';
import { createWorker } from './src/worker.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const onRender = process.env.RENDER === 'true';
const host = onRender ? '0.0.0.0' : process.env.DUCK_HOST ?? '127.0.0.1';
const port = Number(onRender ? process.env.PORT ?? '10000' : process.env.DUCK_PORT ?? '3000');
const pool = createPostgresPool(process.env.DATABASE_URL, process.env.DATABASE_SSL_ROOT_CERT);
const db = createPostgresAdapter(pool);

function logFailure(message, cause) {
  const code = typeof cause?.code === 'string' ? cause.code : cause?.name ?? 'ERROR';
  console.error(`${message} (${code})`);
}

pool.on('error', (cause) => logFailure('PostgreSQL idle connection failed', cause));

const publicRoot = join(root, 'public');
const worker = createWorker(async (name) => {
  try {
    return await readFile(join(publicRoot, name.slice(1)));
  } catch (cause) {
    if (['ENOENT', 'ENOTDIR', 'EISDIR', 'EINVAL'].includes(cause.code)) return null;
    throw cause;
  }
}, { secureCookies: onRender, passwordIterations: 600_000 });

const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]', host]);
const publicOrigins = new Set();
if (onRender) {
  if (!process.env.RENDER_EXTERNAL_URL) throw new Error('RENDER_EXTERNAL_URL is missing.');
  for (const value of [process.env.RENDER_EXTERNAL_URL, process.env.DUCK_PUBLIC_URL]) {
    if (!value) continue;
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Public site URLs must be HTTPS origins without a path.');
    }
    publicOrigins.add(url.origin);
  }
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const requestHost = incoming.headers.host ?? '';
    if (!/^(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::\d{1,5})?$/i.test(requestHost) ||
      !incoming.url?.startsWith('/')) {
      outgoing.writeHead(400).end();
      return;
    }
    const origin = new URL(`${onRender ? 'https' : 'http'}://${requestHost}`);
    if (onRender ? !publicOrigins.has(origin.origin) : !allowedHosts.has(origin.hostname)) {
      outgoing.writeHead(400).end();
      return;
    }

    if (incoming.method === 'GET' && incoming.url === '/healthz') {
      const headers = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' };
      try {
        await db.checkHealth();
        outgoing.writeHead(200, headers).end('ok\n');
      } catch (cause) {
        logFailure('PostgreSQL health check failed', cause);
        outgoing.writeHead(503, headers).end('unavailable\n');
      }
      return;
    }

    const headers = new Headers(incoming.headers);
    const edgeIp = headers.get('cf-connecting-ip') ?? '';
    const clientIp = onRender && isIP(edgeIp) ? edgeIp : incoming.socket.remoteAddress;
    headers.set('cf-connecting-ip', clientIp ?? 'unknown');
    const init = { method: incoming.method, headers };
    if (incoming.method !== 'GET' && incoming.method !== 'HEAD') {
      init.body = Readable.toWeb(incoming);
      init.duplex = 'half';
    }

    const request = new Request(`${origin.origin}${incoming.url}`, init);
    const result = await worker.fetch(request, { DB: db });
    for (const [key, value] of result.headers) {
      if (key !== 'set-cookie') outgoing.setHeader(key, value);
    }
    const cookies = result.headers.getSetCookie();
    if (cookies.length) outgoing.setHeader('Set-Cookie', cookies);
    outgoing.statusCode = result.status;
    if (result.body) {
      Readable.fromWeb(result.body).on('error', () => outgoing.destroy()).pipe(outgoing);
    } else {
      outgoing.end();
    }
  } catch (cause) {
    logFailure('Could not process request', cause);
    if (outgoing.headersSent) {
      outgoing.destroy();
      return;
    }
    if (incoming.url?.startsWith('/api/')) {
      outgoing.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      outgoing.end(JSON.stringify({ error: 'Не удалось обработать запрос. Попробуйте ещё раз.' }));
      return;
    }
    outgoing.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    outgoing.end('Не удалось обработать запрос.');
  }
});

server.listen(port, host, () => {
  const address = server.address();
  const urlHost = address.address.includes(':') ? `[${address.address}]` : address.address;
  console.log(onRender ? `Listening on ${urlHost}:${address.port}` : `Local http://${urlHost}:${address.port}/`);
});

function shutdown() {
  server.close(() => {
    pool.end().catch((cause) => logFailure('Could not close PostgreSQL connections', cause));
  });
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
