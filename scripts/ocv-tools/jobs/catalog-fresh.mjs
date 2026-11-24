import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { run } from "./common.mjs"

export const CATALOG_INPUTS =
  /^packages\/domain\/src\/(?:operations\/|generated\/|operation\.ts$)|^apps\/api\/src\/[^/]+\/operations\/|^apps\/api\/src\/generated\//

const GENERATED =
  /^packages\/domain\/src\/generated\/|^apps\/api\/src\/generated\//

export const CONTRACT_SOURCES = Object.freeze([
  "packages/domain/src/operations",
  "packages/domain/src/operation.ts",
  ":(glob)apps/api/src/*/operations/**",
])

export const STAGED_TREE = Object.freeze([
  "package.json",
  "pnpm-workspace.yaml",
  "packages/domain",
  "apps/api/package.json",
  ":(glob)apps/api/src/*/operations/**",
  "apps/api/src/generated",
  "scripts/catalog.mjs",
  "scripts/lib",
])

export const MODULE_FOLDERS = Object.freeze([
  "node_modules",
  "packages/domain/node_modules",
  "apps/api/node_modules",
])

const JUDGE = fileURLToPath(new URL("../catalog-judge.mjs", import.meta.url))

const split = (out) =>
  String(out ?? "")
    .split("\0")
    .filter(Boolean)
const firstLine = (r) =>
  String(r.err || r.out || "no output")
    .trim()
    .split("\n")[0]

export function touchesCatalog(files) {
  return files.some((file) => CATALOG_INPUTS.test(file))
}

export function catalogFacts(ctx, top, staged) {
  if (!touchesCatalog(staged)) return {}
  if (staged.some((file) => GENERATED.test(file))) {
    const others = run(
      ctx,
      "git",
      [
        "ls-files",
        "-z",
        "--others",
        "--exclude-standard",
        "--",
        ...CONTRACT_SOURCES,
      ],
      { cwd: top, raw: true }
    )
    if (!others.ok)
      return {
        error: `untracked operation files could not be listed: ${firstLine(others)}`,
      }
    const untracked = split(others.out)
    if (untracked.length) return { untracked }
  }
  return ctx.ports.fs.scratchDir("catalog-index-", (dir) =>
    judgeIndex(ctx, top, dir)
  )
}

function judgeIndex(ctx, top, dir) {
  const listed = run(ctx, "git", ["ls-files", "-z", "--", ...STAGED_TREE], {
    cwd: top,
    raw: true,
  })
  if (!listed.ok)
    return {
      error: `the staged files could not be listed: ${firstLine(listed)}`,
    }
  const copied = run(
    ctx,
    "git",
    ["checkout-index", "-z", "--stdin", `--prefix=${dir}/`],
    { cwd: top, input: listed.out }
  )
  if (!copied.ok)
    return {
      error: `the staged files could not be copied: ${firstLine(copied)}`,
    }
  for (const folder of MODULE_FOLDERS)
    ctx.ports.fs.link(join(top, folder), join(dir, folder))
  const judged = run(ctx, "node", [JUDGE, dir], { cwd: dir })
  let parsed
  try {
    parsed = JSON.parse(String(judged.out).trim().split("\n").at(-1))
  } catch {
    return { error: firstLine(judged) }
  }
  if (parsed.error) return { error: parsed.error }
  return { stale: parsed.stale }
}
