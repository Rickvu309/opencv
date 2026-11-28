import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { unresolvedReferences } from "./lib/skill-references.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const skillFiles = () => {
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      ".agents/skills",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => file.endsWith(".md"))
    .filter((file) => existsSync(path.join(root, file)))
  const bySkill = Map.groupBy(files, (file) => file.split("/")[2])
  return [...bySkill.values()].map((paths) =>
    paths.map((file) => ({
      path: file,
      text: readFileSync(path.join(root, file), "utf8"),
    }))
  )
}

const skill = (text, references) => [
  { path: ".agents/skills/check/SKILL.md", text },
  ...references.map((reference, index) => ({
    path: `.agents/skills/check/references/area-${index}.md`,
    text: reference,
  })),
]

const exists = (named) => named === "scripts/ui.mjs"

test("every rule id and file path a skill names exists", () => {
  assert.deepEqual(
    unresolvedReferences(
      skill("State never by colour alone (A3). Run `node scripts/gone.mjs`.", [
        "| A1  | quoted |",
        "",
      ]),
      exists
    ),
    [
      ".agents/skills/check/SKILL.md: rule A3 has no row in references/",
      ".agents/skills/check/SKILL.md: scripts/gone.mjs does not exist",
    ]
  )
  assert.deepEqual(
    unresolvedReferences(
      skill(
        "State never by colour alone (A3). Run `node scripts/ui.mjs up` and see [the tool](../../../scripts/ui.mjs).",
        ["| A3  | quoted |"]
      ),
      exists
    ),
    []
  )
  assert.deepEqual(
    skillFiles().flatMap((files) =>
      unresolvedReferences(files, (named) => existsSync(path.join(root, named)))
    ),
    []
  )
})
