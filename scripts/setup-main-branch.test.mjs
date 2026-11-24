import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { forcedCheckedOutMain } from "./lib/setup-main-branch.mjs"

const action = ".github/actions/setup/action.yml"

test("MISTAKE: a setup step that moves main whatever is checked out fires", () => {
  const problems = forcedCheckedOutMain(
    [
      "    - run: |",
      "        git show-ref --verify --quiet refs/remotes/origin/main || git fetch origin main:refs/remotes/origin/main",
      "        git branch -f main origin/main",
      "      shell: bash",
    ].join("\n"),
    action
  )
  assert.equal(problems.length, 1)
  assert.match(problems[0], /action\.yml:3/)
  assert.match(problems[0], /push to main/)
})

test("a setup step that moves main only from another branch stays quiet", () => {
  assert.deepEqual(
    forcedCheckedOutMain(
      [
        '        if [[ "$(git branch --show-current)" != "main" ]]; then',
        "          git branch -f main origin/main",
        "        fi",
      ].join("\n")
    ),
    []
  )
})

test("the setup action never moves main while main is checked out", () => {
  assert.deepEqual(
    forcedCheckedOutMain(
      readFileSync(new URL(`../${action}`, import.meta.url), "utf8"),
      action
    ),
    []
  )
})
