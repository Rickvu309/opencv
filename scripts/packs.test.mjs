import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { tempDir } from "./lib/temp-dir.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const tool = path.join(root, "node_modules", ".bin", "ts-packwerk")

function packwerk(args, cwd = root) {
  const run = spawnSync(tool, args, {
    cwd,
    encoding: "utf8",
    timeout: 60_000,
  })
  return { code: run.status, out: `${run.stdout}${run.stderr}` }
}

function repoWith(t, files) {
  const dir = tempDir(t, "packs-")
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
    writeFileSync(path.join(dir, name), text)
  }
  return dir
}

const twoPacks = (applyDependencies) => ({
  "packwerk.yml": 'include: ["src/**/*.ts"]\nlayers: [feature, kernel]\n',
  "src/apply/pack.yml": `layer: feature\ndependencies: ${applyDependencies}\n`,
  "src/apply/index.ts": 'import { run } from "../control/index.ts"\nrun()\n',
  "src/control/pack.yml": "layer: kernel\ndependencies: []\n",
  "src/control/index.ts": "export function run() {}\n",
})

test("MISTAKE: a pack that uses a pack it does not declare fires with the file and the fix", (t) => {
  const check = packwerk(["check"], repoWith(t, twoPacks("[]")))
  assert.equal(check.code, 1)
  assert.match(check.out, /src\/apply\/index\.ts:1:\d+\s+dependency/)
  assert.match(check.out, /add it to src\/apply\/pack\.yml/)
})

test("MISTAKE: a lower layer that uses a higher one fires", (t) => {
  const files = twoPacks("[]")
  files["src/control/index.ts"] =
    'import "../apply/index.ts"\nexport function run() {}\n'
  files["src/control/pack.yml"] = "layer: kernel\ndependencies: [src/apply]\n"
  files["src/apply/index.ts"] = "export const apply = 1\n"
  const check = packwerk(["check"], repoWith(t, files))
  assert.equal(check.code, 1)
  assert.match(check.out, /src\/control\/index\.ts:1:\d+\s+layer/)
})

test("MISTAKE: a file that reaches past a pack's public files fires", (t) => {
  const files = twoPacks("[src/control]")
  files["src/control/inside.ts"] = "export function hidden() {}\n"
  files["src/apply/index.ts"] =
    'import { hidden } from "../control/inside.ts"\nhidden()\n'
  const check = packwerk(["check"], repoWith(t, files))
  assert.equal(check.code, 1)
  assert.match(check.out, /src\/apply\/index\.ts:1:\d+\s+privacy/)
})

test("a pack that declares what it uses stays quiet", (t) => {
  const check = packwerk(["check"], repoWith(t, twoPacks("[src/control]")))
  assert.equal(check.code, 0, check.out)
})

test("the code uses only what each pack declares, apart from the recorded todos", () => {
  const check = packwerk(["check"])
  assert.equal(check.code, 0, check.out)
})

test("the packs page matches every pack.yml", () => {
  const docs = packwerk(["docs", "--out", "docs/packs.md", "--check"])
  assert.equal(docs.code, 0, docs.out)
})
