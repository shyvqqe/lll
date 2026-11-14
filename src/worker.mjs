import { handleApi } from "./auth.mjs";

const mediaTypes = {
  avif: "image/avif",
  css: "text/css; charset=utf-8",
  gif: "image/gif",
  html: "text/html; charset=utf-8",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
  woff: "font/woff",
  woff2: "font/woff2",
};

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");

export function createWorker(readAsset, { secureCookies = true, passwordIterations } = {}) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        return handleApi(request, env.DB, { secureCookies, passwordIterations });
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Метод не поддерживается.", {
          status: 405,
          headers: { Allow: "GET, HEAD" },
        });
      }

      let assetPath;
      try {
        assetPath = decodeURIComponent(url.pathname);
      } catch {
        return new Response("Неверный адрес.", { status: 400 });
      }
      if (/[\\:\x00-\x1f]/.test(assetPath) || assetPath.split("/").some((segment) => segment.startsWith("."))) {
        return new Response("Страница не найдена.", { status: 404 });
      }
      if (assetPath === "/") assetPath = "/index.html";

      const body = await readAsset(assetPath);
      if (body == null) return new Response("Страница не найдена.", { status: 404 });

      const extension = assetPath.split(".").at(-1).toLowerCase();
      return new Response(request.method === "HEAD" ? null : body, {
        headers: {
          "Content-Type": Object.hasOwn(mediaTypes, extension)
            ? mediaTypes[extension]
            : "application/octet-stream",
          "Cache-Control": secureCookies && extension !== "html" ? "private, max-age=3600" : "no-store",
          "Content-Security-Policy": contentSecurityPolicy,
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
      });
    },
  };
}
