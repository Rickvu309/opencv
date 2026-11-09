import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detect } from "./lib/paper-package-edit.mjs"

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("word binding keeps the registry basis and the restore compare", () => {
  const commands = read("apps/api/src/paper/commands.ts")
  const edit = read("apps/api/src/paper/package-edit.ts")
  const restore = read("apps/api/src/paper/package-restore.ts")
  assert.deepEqual(detect(commands, "apps/api/src/paper/commands.ts"), [])
  assert.deepEqual(detect(edit, "apps/api/src/paper/package-edit.ts"), [])
  assert.deepEqual(detect(restore, "apps/api/src/paper/package-restore.ts"), [])
  assert.deepEqual(detect("export const unrelated = true", "other.ts"), [])
  assert.ok(
    detect(
      commands.replaceAll("registerWordPackageEdit", "registerSomethingElse"),
      "commands.ts"
    ).some((item) => item.kind === "package-basis-lock")
  )
  assert.ok(
    detect(`${edit}\nconst createdAt = 1\n`, "package-edit.ts").some(
      (item) => item.kind === "package-basis-lock"
    )
  )
  assert.ok(
    detect(
      edit.replace(
        'field: "parentRevision"',
        'field: "parentRevision", column: paperPackageHeads.userId'
      ),
      "package-edit.ts"
    ).some((item) => item.kind === "package-basis-lock")
  )
  assert.ok(
    detect(
      restore.replace(
        "function readPackageHead",
        'function readPackageHead(\n.for("update")'
      ),
      "package-restore.ts"
    ).some((item) => item.kind === "package-basis-lock")
  )
  assert.ok(
    detect(
      restore.replace(
        "eq(paperPackageHeads.revision, expectedRevision)",
        "eq(paperPackageHeads.userId, expectedRevision)"
      ),
      "package-restore.ts"
    ).some((item) => item.kind === "package-basis-lock")
  )
  assert.ok(
    detect(
      restore.replace("if (changed.length !== 1) return unavailable()", ""),
      "package-restore.ts"
    ).some((item) => item.kind === "package-basis-lock")
  )
  assert.ok(
    detect(
      edit.replace(
        `column: paperPackageHeads.incarnation,
      source: "candidate",`,
        `column: paperPackageHeads.docId,
      source: "candidate",`
      ),
      "package-edit.ts"
    ).some((item) => item.kind === "package-basis-lock")
  )
  assert.ok(
    detect(
      edit.replace(
        `column: paperPackageHeads.userId,
      source: "candidate",`,
        `column: paperPackageHeads.docId,
      source: "candidate",`
      ),
      "package-edit.ts"
    ).some((item) => item.kind === "package-basis-lock")
  )
  assert.ok(
    detect(
      edit.replace(
        `column: paperPackageHeads.incarnation,
      source: "snapshot",`,
        `column: paperPackageHeads.docId,
      source: "snapshot",`
      ),
      "package-edit.ts"
    ).some((item) => item.kind === "package-basis-lock")
  )
  assert.ok(
    detect(
      edit.replace('actor.type !== "person"', 'actor.type === "person"'),
      "package-edit.ts"
    ).some((item) => item.kind === "package-basis-lock")
  )
  for (const marker of [
    "revalidate: async (_input, snapshot, actor)",
    "revalidate: async (input, prepared, actor)",
    "commit: async (input, prepared, actor, locked)",
  ]) {
    const at = edit.indexOf(marker)
    const call = edit.indexOf("requirePackageEnabled()", at)
    assert.notEqual(at, -1)
    assert.notEqual(call, -1)
    const dropped =
      edit.slice(0, call) + edit.slice(call + "requirePackageEnabled()".length)
    assert.ok(
      detect(dropped, "package-edit.ts").some(
        (item) => item.kind === "package-basis-lock"
      )
    )
  }
})
