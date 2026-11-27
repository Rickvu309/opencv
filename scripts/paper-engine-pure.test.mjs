import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  PAPER_ENGINE_ROOT,
  paperEnginePurityProblems,
} from "./lib/paper-engine-pure.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const file = "packages/paper-engine/src/commands.ts"

const MISTAKES = [
  `import { readFileSync } from "node:fs"`,
  `import path from "path"`,
  `const { join } = require("node:path")`,
  `import { eq } from "drizzle-orm"`,
  `import { Hono } from "hono"`,
  `import { streamText } from "ai"`,
  `import { anthropic } from "@ai-sdk/anthropic"`,
  `const mod = await import("@workspace/api/paper")`,
  `const at = Date.now()`,
  `const stamp = new Date()`,
  `const id = Math.random().toString(36)`,
  `const id = crypto.randomUUID()`,
  `const t = performance.now()`,
  `const node = document.createElement("div")`,
  `const range = window.getSelection()`,
  `const lang = navigator.language`,
  `requestAnimationFrame(paint)`,
  `const parsed = new DOMParser().parseFromString(html, "text/html")`,
]

const CLEAN = [
  `import { Schema } from "prosemirror-model"`,
  `import { EditorState } from "prosemirror-state"`,
  `import { documentSchema, type Document } from "@workspace/domain/paper-doc"`,
  `const documents = new WeakMap<Node, Document>()`,
  `export function toDocument(doc: Node): Document { return documents.get(doc)! }`,
  `const at = ports.now()`,
  `const id = ports.ids()`,
  `return { doc: toDocument(pm.doc), selection }`,
  `const windowSize = 3`,
]

test("DOM globals, Node built-ins, database, server and AI imports, clocks and randomness fire in the Paper engine", () => {
  for (const source of MISTAKES) {
    assert.ok(
      paperEnginePurityProblems(source, file).length > 0,
      `expected to fire: ${source}`
    )
  }
})

test("pure engine code and code outside the Paper engine stay quiet", () => {
  for (const source of CLEAN) {
    assert.deepEqual(paperEnginePurityProblems(source, file), [], source)
  }
  assert.deepEqual(
    paperEnginePurityProblems(
      `const at = Date.now()`,
      "apps/api/src/paper/paper.ts"
    ),
    []
  )
})

test("packages/paper-engine has no DOM, Node, database, server, AI, clock or random code", () => {
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      PAPER_ENGINE_ROOT,
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((name) => /\.[cm]?[jt]sx?$/.test(name))
    .filter((name) => existsSync(path.join(root, name)))
  assert.ok(files.length > 0, "expected Paper engine sources")
  const problems = files.flatMap((name) =>
    paperEnginePurityProblems(readFileSync(path.join(root, name), "utf8"), name)
  )
  assert.deepEqual(problems, [])
})
