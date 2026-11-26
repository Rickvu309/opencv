import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detect } from "./lib/paper-package-edit.mjs"

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("word binding keeps the registry basis and the restore compare", () => {
  const commands = read("apps/api/src/paper/commands.ts")
  const server = read("apps/api/src/paper/operations/edit/server.ts")
  const edit = read("apps/api/src/paper/package-edit.ts")
  const restore = read("apps/api/src/paper/package-restore.ts")
  assert.deepEqual(detect(commands, "apps/api/src/paper/commands.ts"), [])
  assert.deepEqual(
    detect(server, "apps/api/src/paper/operations/edit/server.ts"),
    []
  )
  assert.deepEqual(detect(edit, "apps/api/src/paper/package-edit.ts"), [])
  assert.deepEqual(detect(restore, "apps/api/src/paper/package-restore.ts"), [])
  assert.deepEqual(detect("export const unrelated = true", "other.ts"), [])
  assert.ok(
    detect(
      server.replace("reviewed: wordPackageReview", "reviewed: anyReview"),
      "apps/api/src/paper/operations/edit/server.ts"
    ).some((item) => item.kind === "package-basis-lock")
  )
  assert.ok(
    detect(
      `${commands}\nregistry.addCommand({ name: "paper.edit" })\n`,
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
})
