import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const skills = path.join(root, ".claude/skills")

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name !== "node_modules") yield* files(full)
    } else if (/\.(?:md|mjs|sh|json)$/.test(name)) yield full
  }
}

const RETIRED_APP_PATH = /(?<![\w/.$-])\/app(?![\w-])/g
const URL_APP_PATH =
  /(?:\$\{?\w+\}?|\*\*|https?:\/\/[^\s/`"']+)(\/app)(?![\w-])/g
const LEGACY_BEFORE = /legacy\s*`?$/i

function staleAppPaths(line) {
  const starts = [
    ...[...line.matchAll(RETIRED_APP_PATH)].map((hit) => hit.index),
    ...[...line.matchAll(URL_APP_PATH)].map(
      (hit) => hit.index + hit[0].length - hit[1].length
    ),
  ]
  return starts.filter((at) => !LEGACY_BEFORE.test(line.slice(0, at)))
}

test("verify skills name product routes without the retired /app prefix", () => {
  const hits = []
  for (const file of files(skills)) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (staleAppPaths(line).length > 0)
          hits.push(
            `${path.relative(root, file)}:${index + 1} ${line.trim().slice(0, 100)}`
          )
      })
  }
  assert.deepEqual(
    hits,
    [],
    `#485 removed the /app prefix and the old paths redirect, so a stale skill sees the right screen and never learns the route moved. Use the route from SURFACE_PATHS in apps/web/src/lib/product-paths.ts (for example /coach, not /app/coach). Name a legacy /app path only right after the word "legacy".\n${hits.join("\n")}`
  )
})
