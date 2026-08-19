import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export function resolvePublicFile(rootDir, urlPath) {
  const root = path.resolve(rootDir);
  const raw = (urlPath ?? "/").split("?")[0] ?? "/";
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  if (path.isAbsolute(rel)) return null;
  const abs = path.resolve(root, rel);
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (abs !== root && !abs.startsWith(prefix)) return null;
  return abs;
}

export function createStorybookServer(rootDir) {
  const root = path.resolve(rootDir);
  return http.createServer((req, res) => {
    const file = resolvePublicFile(root, req.url ?? "/");
    if (!file) {
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
      res.writeHead(200, {
        "content-type": type,
        "cache-control": "public, max-age=60",
      });
      fs.createReadStream(file).pipe(res);
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? "storybook-static";
  const port = Number(process.env.PORT ?? 8080);
  const server = createStorybookServer(dir);
  server.listen(port, "0.0.0.0", () => {
    console.log(`Storybook static on :${port} from ${path.resolve(dir)}`);
  });
}
