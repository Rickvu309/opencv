import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "overrides",
  "resolutions",
]
const BANNED = /^@blocknote\/xl-/
const MPL_PACKAGE = /^@blocknote\//
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

export function dependencyProblems(file, manifest) {
  const problems = []
  const fields = [
    ...DEPENDENCY_FIELDS.map((field) => [field, manifest[field]]),
    ["pnpm.overrides", manifest.pnpm?.overrides],
  ]
  for (const [field, entries] of fields) {
    for (const [name, range] of Object.entries(entries ?? {})) {
      if (BANNED.test(name)) {
        problems.push(
          `${file} lists ${name} in ${field}. The @blocknote/xl-* packages are GPL-3.0 or paid.`
        )
      } else if (MPL_PACKAGE.test(name) && !EXACT_VERSION.test(range)) {
        problems.push(
          `${file} lists ${name} as "${range}" in ${field}. Pin @blocknote/* to one exact version.`
        )
      }
    }
  }
  return problems
}

export function lockfileProblems(file, lockfile) {
  return /@blocknote\/xl-/.test(lockfile)
    ? [`${file} resolves an @blocknote/xl-* package. They are GPL-3.0 or paid.`]
    : []
}

const tracked = (pattern) =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", pattern],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean)

const read = (file) => readFileSync(path.join(root, file), "utf8")

test("no package.json lists a BlockNote XL package or an unpinned BlockNote package", () => {
  const manifests = [...tracked("package.json"), ...tracked("**/package.json")]
  assert.ok(manifests.length > 1, "git ls-files found no package.json")
  const problems = [...new Set(manifests)].flatMap((file) =>
    dependencyProblems(file, JSON.parse(read(file)))
  )
  assert.deepEqual(problems, [])
})

test("the lockfile resolves no BlockNote XL package", () => {
  assert.deepEqual(
    lockfileProblems("pnpm-lock.yaml", read("pnpm-lock.yaml")),
    []
  )
})

test("a manifest that lists @blocknote/xl-ai is caught", () => {
  const problems = dependencyProblems("apps/web/package.json", {
    dependencies: { "@blocknote/xl-ai": "0.57.0" },
  })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /@blocknote\/xl-ai/)
})

test("an XL package in devDependencies, peerDependencies or overrides is caught", () => {
  for (const field of ["devDependencies", "peerDependencies", "overrides"]) {
    const problems = dependencyProblems("package.json", {
      [field]: { "@blocknote/xl-multi-column": "0.57.0" },
    })
    assert.equal(problems.length, 1, field)
  }
  assert.equal(
    dependencyProblems("package.json", {
      pnpm: { overrides: { "@blocknote/xl-pdf-exporter": "0.57.0" } },
    }).length,
    1
  )
})

test("a range, tag or workspace link on a @blocknote package is caught", () => {
  for (const range of [
    "^0.57.0",
    "~0.57.0",
    "latest",
    "workspace:*",
    "*",
    "",
  ]) {
    const problems = dependencyProblems("package.json", {
      dependencies: { "@blocknote/core": range },
    })
    assert.equal(problems.length, 1, range)
  }
})

test("exact @blocknote pins and unrelated packages pass", () => {
  assert.deepEqual(
    dependencyProblems("package.json", {
      dependencies: {
        "@blocknote/core": "0.57.0",
        "@blocknote/react": "0.57.0",
        "@blocknote-like/thing": "^1.0.0",
        yjs: "^13.6.33",
      },
    }),
    []
  )
})

test("a lockfile that mentions an XL package is caught", () => {
  assert.equal(
    lockfileProblems("pnpm-lock.yaml", "  '@blocknote/xl-ai@0.57.0':\n").length,
    1
  )
  assert.deepEqual(
    lockfileProblems("pnpm-lock.yaml", "  '@blocknote/core@0.57.0':\n"),
    []
  )
})
