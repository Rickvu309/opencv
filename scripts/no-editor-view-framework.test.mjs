import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { editorViewFrameworkProblems } from "./lib/no-editor-view-framework.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const MISTAKES = [
  [
    `import { EditorView } from "prosemirror-view"`,
    "packages/paper-engine/src/view.ts",
  ],
  [
    `import { Editor } from "@tiptap/core"`,
    "apps/web/src/features/paper/editor/paper-editor.tsx",
  ],
  [
    `import { BlockNoteEditor } from "@blocknote/core"`,
    "packages/paper-engine/src/blocks.ts",
  ],
  [`import * as Y from "yjs"`, "apps/api/src/paper/log/log.ts"],
  [
    `import { ySyncPlugin } from "y-prosemirror"`,
    "packages/paper-engine/src/sync.ts",
  ],
  [
    `const pm = await import("@tiptap/pm/view")`,
    "apps/api/src/paper/word/read-docx.ts",
  ],
  [
    JSON.stringify({
      dependencies: { "prosemirror-model": "1.25.12", yjs: "13.6.33" },
    }),
    "packages/paper-engine/package.json",
  ],
  [`import * as Y from "yjs"`, "packages/paper-crdt/src/client.ts"],
  [
    `import { BlockNoteView } from "@blocknote/react"`,
    "apps/web/src/features/paper/rich-editor/rich-page.tsx",
  ],
  [
    JSON.stringify({ dependencies: { "@blocknote/core": "0.57.0" } }),
    "apps/web/package.json",
  ],
  [JSON.stringify({ devDependencies: { yjs: "13.6.33" } }), "package.json"],
]

const CLEAN = [
  [
    `import { Schema } from "prosemirror-model"`,
    "packages/paper-engine/src/schema.ts",
  ],
  [
    `import { Transform } from "prosemirror-transform"`,
    "packages/paper-engine/src/commands.ts",
  ],
  [
    `import { history } from "prosemirror-history"`,
    "packages/paper-engine/src/history.ts",
  ],
  [`import * as Y from "yjs"`, "scripts/property-seed.test.mjs"],
  [
    JSON.stringify({ dependencies: { "prosemirror-model": "1.25.12" } }),
    "packages/paper-engine/package.json",
  ],
]

test("prosemirror-view, Tiptap, BlockNote and Yjs fire anywhere in the repo", () => {
  for (const [source, file] of MISTAKES) {
    assert.ok(
      editorViewFrameworkProblems(source, file).length > 0,
      `expected ${file} to fire: ${source}`
    )
  }
})

test("headless ProseMirror and guard fixtures under scripts stay quiet", () => {
  for (const [source, file] of CLEAN) {
    assert.deepEqual(editorViewFrameworkProblems(source, file), [], file)
  }
})

test("the repo uses no editor view framework", () => {
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((name) => /(?:\.[cm]?[jt]sx?|package\.json)$/.test(name))
    .filter((name) => existsSync(path.join(root, name)))
  assert.ok(files.length > 0, "expected repo source files")
  const problems = files.flatMap((name) =>
    editorViewFrameworkProblems(
      readFileSync(path.join(root, name), "utf8"),
      name
    )
  )
  assert.deepEqual(problems, [])
})
