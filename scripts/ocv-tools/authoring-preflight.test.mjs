import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "../lib/authoring-preflight.mjs"
import { validateAuthoring } from "./authoring.mjs"
import { evaluate } from "./rules/index.mjs"

test("take, save and finish call the shared metadata preflight", () => {
  for (const path of ["take.mjs", "work.mjs", "jobs/finish.mjs"])
    assert.deepEqual(
      detect(readFileSync(new URL(path, import.meta.url), "utf8")),
      [],
      path
    )
})

test("a missing preflight fires and a preflight call stays quiet", () => {
  assert.deepEqual(detect("export function save() { push() }"), [1])
  assert.deepEqual(
    detect("export function save() { validateAuthoring(facts); push() }"),
    []
  )
})

test("authoring uses the policy title and Closes rule unchanged", () => {
  for (const title of [
    "feat: keep words (#90)",
    "fix(api): keep words (#90)",
    "fix!: keep words (#90)",
    "Keep words (#90)",
    "fix: keep words (#89)",
  ])
    for (const body of [
      "Closes #90",
      "Closes #900",
      "Fixes #90",
      "closes #90",
      "Text\nCloses #90\n",
    ])
      for (const state of ["OPEN", "CLOSED"]) {
        const pull = { title, body, issue: 90, issueState: state }
        const refusal = evaluate("PR_METADATA", { pull })
        const call = () =>
          validateAuthoring({
            n: 90,
            issue: { title: "feat: keep words", state },
            pull,
          })
        if (refusal)
          assert.throws(call, (error) => error.code === "PR_METADATA")
        else assert.doesNotThrow(call)
      }
})
