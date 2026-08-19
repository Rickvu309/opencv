#!/usr/bin/env node
/**
 * Drive every Lab Storybook story through Vite + the preview iframe.
 * Usage: node scripts/test-lab-stories.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.LAB_STORYBOOK_URL ?? "http://localhost:6007";
const INGEST = "http://127.0.0.1:7463/ingest/31b9bc65-3315-4002-b28e-ccf62e56ebc9";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CATALOG = path.join(ROOT, "packages/opath-ui/src/lab/catalog");

async function debugLog(payload) {
  await fetch(INGEST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "e76d8f",
    },
    body: JSON.stringify({
      sessionId: "e76d8f",
      runId: "storybook-all",
      timestamp: Date.now(),
      ...payload,
    }),
  }).catch(() => {});
}

function viteUrlFromDisk(absPath) {
  const rel = absPath.replace(/\\/g, "/");
  const marker = "/packages/opath-ui/";
  const idx = rel.indexOf(marker);
  if (idx === -1) return null;
  return "/" + rel.slice(idx + marker.length);
}

function collectLazySpecifiers() {
  const files = fs.readdirSync(CATALOG).filter((f) => f.endsWith(".stories.tsx"));
  const specs = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(CATALOG, file), "utf8");
    for (const match of text.matchAll(/import\("([^"]+)"\)/g)) {
      specs.push({ catalog: file, specifier: match[1] });
    }
  }
  return specs;
}

function resolveSpecifier(catalogFile, specifier) {
  const from = path.dirname(path.join(CATALOG, catalogFile));
  const abs = path.resolve(from, specifier);
  const candidates = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];
  for (const extra of candidates) {
    const candidate = abs + extra;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return abs;
}

async function fetchStatus(url) {
  const res = await fetch(url);
  const text = await res.text();
  const fail =
    !res.ok ||
    text.includes("Failed to resolve import") ||
    text.includes("Internal server error") ||
    text.includes("Failed to fetch dynamically imported module");
  let missing = null;
  const m = text.match(/Failed to resolve import "([^"]+)"/);
  if (m) missing = m[1];
  return { ok: !fail && res.ok, status: res.status, missing, snippet: text.slice(0, 240) };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const indexRes = await fetch(`${BASE}/index.json`);
const index = await indexRes.json();
const entries = Object.values(index.entries ?? {});
const titles = {};
for (const e of entries) titles[e.title] = (titles[e.title] ?? 0) + 1;

await debugLog({
  hypothesisId: "E",
  location: "scripts/test-lab-stories.mjs",
  message: "Storybook index loaded",
  data: { status: indexRes.status, stories: entries.length, titles: Object.keys(titles).length },
});

const csfPaths = [...new Set(entries.map((e) => e.importPath))];
const csfResults = [];
for (const importPath of csfPaths) {
  const disk = path.join(ROOT, importPath.replace(/^\.\//, ""));
  const urlPath = viteUrlFromDisk(disk);
  const url = `${BASE}${urlPath}`;
  const result = await fetchStatus(url);
  csfResults.push({ importPath, url, ...result });
  if (!result.ok) {
    await debugLog({
      hypothesisId: "C",
      location: "scripts/test-lab-stories.mjs",
      message: "CSF module failed",
      data: { importPath, status: result.status, missing: result.missing, snippet: result.snippet },
    });
  }
}

const specs = collectLazySpecifiers();
const unique = [];
const seen = new Set();
for (const spec of specs) {
  const disk = resolveSpecifier(spec.catalog, spec.specifier);
  const urlPath = viteUrlFromDisk(disk) ?? `/src/lab/${spec.specifier.replace(/^\.\.\//, "")}`;
  const key = urlPath;
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push({ ...spec, disk, url: `${BASE}${urlPath}`, exists: fs.existsSync(disk) });
}

await debugLog({
  hypothesisId: "E",
  location: "scripts/test-lab-stories.mjs",
  message: "Lazy specifiers collected",
  data: { catalogStories: specs.length, uniqueModules: unique.length, missingOnDisk: unique.filter((u) => !u.exists).length },
});

const chunkResults = await mapLimit(unique, 6, async (item) => {
  if (!item.exists) {
    return { ...item, ok: false, status: 0, missing: "file-not-on-disk", snippet: item.disk };
  }
  const result = await fetchStatus(item.url);
  return { ...item, ...result };
});

const failed = chunkResults.filter((r) => !r.ok);
const missingCounts = {};
for (const f of failed) {
  const key = f.missing ?? `status-${f.status}`;
  missingCounts[key] = (missingCounts[key] ?? 0) + 1;
}

await debugLog({
  hypothesisId: "A",
  location: "scripts/test-lab-stories.mjs",
  message: "Vite chunk sweep complete",
  data: {
    csfOk: csfResults.filter((r) => r.ok).length,
    csfFail: csfResults.filter((r) => !r.ok).length,
    chunksOk: chunkResults.filter((r) => r.ok).length,
    chunksFail: failed.length,
    missingCounts,
    failedSample: failed.slice(0, 25).map((f) => ({
      catalog: f.catalog,
      url: f.url,
      status: f.status,
      missing: f.missing,
    })),
  },
});

const aliasHits = failed.filter((f) =>
  /^(next\/|next-themes|@\/lib\/|@\/components\/|@paper-design|lenis)/.test(f.missing ?? ""),
);
await debugLog({
  hypothesisId: "A",
  location: "scripts/test-lab-stories.mjs",
  message: "Alias-related chunk failures",
  data: { count: aliasHits.length, missing: [...new Set(aliasHits.map((f) => f.missing))] },
});

console.log(
  JSON.stringify(
    {
      stories: entries.length,
      csf: { ok: csfResults.filter((r) => r.ok).length, fail: csfResults.filter((r) => !r.ok).length },
      chunks: { ok: chunkResults.filter((r) => r.ok).length, fail: failed.length, missingCounts },
      failed: failed.map((f) => ({ catalog: f.catalog, specifier: f.specifier, missing: f.missing, status: f.status })),
    },
    null,
    2,
  ),
);
