import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detect, detectRollback } from "./lib/paper-content-isolation.mjs"

const clean = `
function detached(entry) { return { ...entry, yDoc: forkOf(entry.yDoc) } }
async function withLiveTransaction(run) {
  const committed = {}
  const result = await transaction(() => run((docId, entry) => {
    committed.head = {docId, entry}
  }))
  if (committed.head && !insideTransaction()) {
    remember(committed.head.docId, committed.head.entry)
  }
  return result
}
async function hydrate(row) {
  const cached = live.get(row.id)
  if (cached) {
    const current = await caughtUp(detached(cached), row, row.crdtBase)
    if (current) {
      return current
    }
  }
  return freshLive(row, row.crdtBase)
}
async function withContent(owner, docId, run) {
  return withLiveTransaction(async retain => {
    let entry = await hydrate(row)
    let latest = row
    const content = {
      edit: async change => {
        const candidate = detached(entry)
        const next = await editLocked(latest, candidate, change)
        entry = candidate
        latest = next
        return latest
      },
      append: async change => {
        const candidate = detached(entry)
        const next = await appendLocked(latest, candidate, change)
        if (next.row) {
          entry = candidate
          latest = next.row
        }
        return next
      }
    }
    const result = await run(content)
    retain(row.id, entry)
    return result
  })
}
async function syncContent() {
  return withLiveTransaction(async retain => {
    const entry = await hydrate(row)
    absorbUpdate(entry.yDoc, update)
    retain(row.id, entry)
    return reply(entry)
  })
}`

const mistakes = [
  ["forkOf(entry.yDoc)", "entry.yDoc", "paper-live-detached-fork"],
  [
    "{ ...entry, yDoc: forkOf(entry.yDoc) }",
    "{ yDoc: forkOf(entry.yDoc), ...entry }",
    "paper-live-detached-fork",
  ],
  [
    "caughtUp(detached(cached)",
    "caughtUp(cached",
    "paper-cache-detached-hydration",
  ],
  [
    "if (current) {",
    "if (current) { remember(row.id, current);",
    "paper-cache-uncommitted-hydration",
  ],
  [
    "!insideTransaction()",
    "insideTransaction()",
    "paper-cache-after-outer-commit",
  ],
  [
    "const result = await transaction(",
    "const result = transaction(",
    "paper-cache-after-outer-commit",
  ],
  [
    "editLocked(latest, candidate",
    "editLocked(latest, entry",
    "paper-edit-attempt-isolation",
  ],
  [
    "appendLocked(latest, candidate",
    "appendLocked(latest, entry",
    "paper-append-attempt-isolation",
  ],
  ["if (next.row)", "if (next)", "paper-append-attempt-isolation"],
  ["await editLocked(", "editLocked(", "paper-edit-attempt-isolation"],
  ["await appendLocked(", "appendLocked(", "paper-append-attempt-isolation"],
  ["entry = candidate", "entry = entry", "paper-edit-attempt-isolation"],
  ["latest = next.row", "latest = latest", "paper-append-attempt-isolation"],
  ["latest = next\n", "latest = latest\n", "paper-edit-attempt-isolation"],
]

test("Paper mutations detach cached heads and publish only after the outer commit", () => {
  assert.deepEqual(detect(clean), [])
  assert.deepEqual(detectRollback(clean), [])
  assert.deepEqual(detect("export const unrelated = true"), [])
  const source = readFileSync(
    new URL("../apps/api/src/paper/content-store.ts", import.meta.url),
    "utf8"
  )
  assert.deepEqual(detect(source), [])
  for (const [before, after, kind] of mistakes) {
    for (const input of [clean, source]) {
      const changed = input.replace(before, after)
      assert.notEqual(changed, input, before)
      assert.ok(
        detect(changed).some((problem) => problem.kind === kind),
        kind
      )
    }
  }
  assert.ok(
    detect(
      clean.replaceAll("withLiveTransaction(async", "transaction(async")
    ).some((problem) => problem.kind === "paper-live-transaction-boundary")
  )
})

const editorWriteClean = `
import { updateYFragment } from "y-prosemirror"
import { admitWriteTarget, headlessEditor } from "./ydoc.js"
export function writeAsEditor(yDoc, target, origin) {
  target = admitWriteTarget(yDoc, target)
  const node = blocksToNode(headlessEditor(target.version), toEditorBlocks(target))
  const binding = bindings.get(yDoc) ?? {mapping: new Map(), isOMark: new Map()}
  bindings.set(yDoc, binding)
  yDoc.transact(() => updateYFragment(yDoc, yDoc.getXmlFragment(FRAGMENT), node, binding), origin)
}
`

const editorWriteMistakes = [
  [
    "missing call",
    (source) =>
      source.replace("  target = admitWriteTarget(yDoc, target)\n", ""),
  ],
  [
    "after mutation",
    (source) =>
      source
        .replace("  target = admitWriteTarget(yDoc, target)\n", "")
        .replace(
          "), origin)",
          "), origin)\n  target = admitWriteTarget(yDoc, target)"
        ),
  ],
  [
    "after conversion",
    (source) =>
      source
        .replace("  target = admitWriteTarget(yDoc, target)\n", "")
        .replace(
          "  const binding =",
          "  target = admitWriteTarget(yDoc, target)\n  const binding ="
        ),
  ],
  [
    "after binding mutation",
    (source) =>
      source
        .replace("  target = admitWriteTarget(yDoc, target)\n", "")
        .replace(
          "  yDoc.transact",
          "  target = admitWriteTarget(yDoc, target)\n  yDoc.transact"
        ),
  ],
  [
    "conditional call",
    (source) =>
      source.replace(
        "target = admitWriteTarget(yDoc, target)",
        "if (enabled) target = admitWriteTarget(yDoc, target)"
      ),
  ],
  [
    "deferred call",
    (source) =>
      source.replace(
        "target = admitWriteTarget(yDoc, target)",
        "const admit = () => admitWriteTarget(yDoc, target)"
      ),
  ],
  [
    "wrong document",
    (source) =>
      source.replace(
        "admitWriteTarget(yDoc, target)",
        "admitWriteTarget(otherDoc, target)"
      ),
  ],
  [
    "wrong target",
    (source) =>
      source.replace(
        "admitWriteTarget(yDoc, target)",
        "admitWriteTarget(yDoc, otherTarget)"
      ),
  ],
  [
    "discarded parse",
    (source) =>
      source.replace(
        "target = admitWriteTarget(yDoc, target)",
        "admitWriteTarget(yDoc, target)"
      ),
  ],
  [
    "untrusted helper",
    (source) => source.replace('from "./ydoc.js"', 'from "./other.js"'),
  ],
  [
    "type-only helper",
    (source) =>
      source.replace(
        "import { admitWriteTarget, headlessEditor }",
        "import type { admitWriteTarget, headlessEditor }"
      ),
  ],
]

test("exported direct CRDT writers admit parsed identity before conversion, binding or mutation", () => {
  assert.deepEqual(detect(editorWriteClean, "editor-write.ts"), [])
  const source = readFileSync(
    new URL("../packages/paper-crdt/src/editor-write.ts", import.meta.url),
    "utf8"
  )
  assert.deepEqual(detect(source, "editor-write.ts"), [])
  for (const [name, change] of editorWriteMistakes) {
    const mistake = change(editorWriteClean)
    assert.notEqual(mistake, editorWriteClean, name)
    assert.ok(
      detect(mistake, "editor-write.ts").some(
        (problem) => problem.kind === "paper-editor-write-admission"
      ),
      name
    )
  }
  assert.deepEqual(
    detect(
      editorWriteClean
        .replace("admitWriteTarget,", "admitWriteTarget as admit,")
        .replace("target = admitWriteTarget(", "target = admit("),
      "editor-write.ts"
    ),
    []
  )
  const alias = editorWriteClean
    .replace("updateYFragment }", "updateYFragment as update }")
    .replace("() => updateYFragment(", "() => update(")
  assert.deepEqual(detect(alias, "editor-write.ts"), [])
  assert.ok(
    detect(editorWriteMistakes[0][1](alias), "editor-write.ts").some(
      (problem) => problem.kind === "paper-editor-write-admission"
    )
  )
  const variable = editorWriteClean.replace(
    "export function writeAsEditor(yDoc, target, origin) {",
    "export const writeAsEditor = (yDoc, target, origin) => {"
  )
  assert.deepEqual(detect(variable, "editor-write.ts"), [])
  assert.ok(
    detect(editorWriteMistakes[0][1](variable), "editor-write.ts").some(
      (problem) => problem.kind === "paper-editor-write-admission"
    )
  )
  const named =
    editorWriteClean.replace(
      "export function writeAsEditor",
      "function writeAsEditor"
    ) + "\nexport {writeAsEditor}"
  assert.deepEqual(detect(named, "editor-write.ts"), [])
  assert.ok(
    detect(editorWriteMistakes[0][1](named), "editor-write.ts").some(
      (problem) => problem.kind === "paper-editor-write-admission"
    )
  )
})
