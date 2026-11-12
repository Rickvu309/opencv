import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  BEFORE_AFTER_FIX,
  beforeAfterProblem,
  shownUiFiles,
} from "./before-after.mjs"
import { evaluate, needsOf, RULES } from "./index.mjs"

const fixture = (name) =>
  readFileSync(new URL(`pr-body-fixtures/${name}`, import.meta.url), "utf8")

const SCREEN_FILES = [
  "apps/web/src/features/coach/coach-panel.tsx",
  "apps/web/src/features/coach/coach-panel-sheet.css",
]

test("screen files are tsx and css under features, components and the ui kit, not tests", () => {
  assert.deepEqual(
    shownUiFiles([
      ...SCREEN_FILES,
      "apps/web/src/features/coach/coach-panel.test.tsx",
      "apps/web/src/features/coach/__tests__/x.tsx",
      "apps/web/src/components/ai-elements/message.tsx",
      "packages/ui/src/components/button.tsx",
      "packages/ui/src/styles/globals.css",
      "apps/web/src/lib/api.ts",
      "apps/web/src/features/coach/coach-config.ts",
      "apps/api/src/coach/run.tsx",
      "scripts/ui/annotate.mjs",
    ]),
    [
      ...SCREEN_FILES,
      "apps/web/src/components/ai-elements/message.tsx",
      "packages/ui/src/components/button.tsx",
      "packages/ui/src/styles/globals.css",
    ]
  )
})

test("the mistake fixture fires: a screen change without Before / after is refused with the commands that fix it", () => {
  const hit = evaluate("NO_BEFORE_AFTER", {
    pull: { body: fixture("ui-without-before-after.txt") },
    diff: { files: SCREEN_FILES },
  })
  assert.match(
    hit.message,
    /edits 2 screen file\(s\).*no ## Before \/ after section/
  )
  assert.equal(hit.fix, BEFORE_AFTER_FIX)
  for (const command of ["compare", "annotate", "pr-section"])
    assert.match(hit.fix, new RegExp(`\\b${command}\\b`))
})

test("the clean fixtures stay quiet: an image and the main / this PR table, or an honest No visible change", () => {
  for (const name of ["ui-with-before-after.txt", "ui-no-visible-change.txt"])
    assert.equal(beforeAfterProblem(fixture(name), SCREEN_FILES), null, name)
})

test("a change with no screen file needs no Before / after section", () => {
  assert.equal(
    beforeAfterProblem(fixture("ui-without-before-after.txt"), [
      "scripts/ui/annotate.mjs",
      "apps/web/src/features/coach/coach-panel.test.tsx",
    ]),
    null
  )
})

test("half a section names what it lacks, and a bare No visible change needs its reason", () => {
  const only = (inner) =>
    `## Summary\n\nx\n\n## Before / after\n\n${inner}\n\n## Merge Danger\n\nx`
  assert.match(
    beforeAfterProblem(only("![a](https://x/a.png)"), SCREEN_FILES),
    /lacks a \| main \| this PR \| table$/
  )
  assert.match(
    beforeAfterProblem(only("| main | this PR |\n| --- | --- |"), SCREEN_FILES),
    /lacks an image$/
  )
  assert.match(
    beforeAfterProblem(only("No visible change."), SCREEN_FILES),
    /needs one sentence of reason/
  )
  assert.match(
    beforeAfterProblem(
      only("Nothing changed, No visible change."),
      SCREEN_FILES
    ),
    /lacks an image and a \| main \| this PR \| table$/
  )
})

test("finish and the live pull request policy run the row; both gather the body and the diff", () => {
  const row = RULES.find((item) => item.id === "NO_BEFORE_AFTER")
  assert.deepEqual(row.at, ["finish", "pr"])
  for (const moment of row.at)
    for (const kind of row.needs) assert.ok(needsOf(moment).includes(kind))
})
