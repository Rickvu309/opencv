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

test("the clean fixture stays quiet: an image and the main / this PR table", () => {
  assert.equal(
    beforeAfterProblem(fixture("ui-with-before-after.txt"), SCREEN_FILES),
    null
  )
})

const PR_1406_SCREEN_FILES = [
  "apps/web/src/features/auth/auth-copy.ts",
  "apps/web/src/features/auth/auth.test.tsx",
  "apps/web/src/features/auth/sign-in-screen.reducer.ts",
  "apps/web/src/features/auth/sign-in-screen.tsx",
]

test("the truth fixture fires: No visible change. while the diff edits a screen file, as PR #1406 said while its sign-in screen changed", () => {
  for (const files of [SCREEN_FILES, PR_1406_SCREEN_FILES]) {
    const hit = evaluate("NO_BEFORE_AFTER", {
      pull: { body: fixture("ui-no-visible-change.txt") },
      diff: { files },
    })
    assert.match(
      hit.message,
      /screen file\(s\).*"No visible change\." is a claim the pictures must show/
    )
  }
  assert.equal(
    beforeAfterProblem(
      fixture("ui-no-visible-change.txt"),
      PR_1406_SCREEN_FILES.filter((file) => !file.endsWith(".tsx"))
    ),
    null
  )
})

const PR_1410_FILES = [
  "apps/web/src/features/paper/paper-library.tsx",
  "scripts/paper-one-kind.test.mjs",
]

test("a stacked PR is told its base branch holds the screen files, as PR #1410 on fix/1404-word-card-actions was", () => {
  const stacked = evaluate("NO_BEFORE_AFTER", {
    pull: { body: "## Summary\n\nx", base: "fix/1404-word-card-actions" },
    diff: { files: PR_1410_FILES },
  })
  assert.match(
    stacked.message,
    /stacked on fix\/1404-word-card-actions, so its diff against main also holds that branch's screen files: merge fix\/1404-word-card-actions first and rebase/
  )
  const onMain = evaluate("NO_BEFORE_AFTER", {
    pull: { body: "## Summary\n\nx", base: "main" },
    diff: { files: PR_1410_FILES },
  })
  assert.doesNotMatch(onMain.message, /stacked/)
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

test("half a section names what it lacks, and No visible change. needs the pictures", () => {
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
    /is a claim the pictures must show/
  )
  assert.match(
    beforeAfterProblem(
      only("Nothing changed, No visible change."),
      SCREEN_FILES
    ),
    /put the compare image and the \| main \| this PR \| table/
  )
})

test("finish, body and the live pull request policy run the row; each gathers the body and the diff", () => {
  const row = RULES.find((item) => item.id === "NO_BEFORE_AFTER")
  assert.deepEqual(row.at, ["finish", "body", "pr"])
  for (const moment of row.at)
    for (const kind of row.needs) assert.ok(needsOf(moment).includes(kind))
})
