import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  coachRadiusLiterals,
  isCoachSource,
} from "./lib/coach-radius-tokens.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const MISTAKES = [
  `<div className="flex rounded-[12px] border border-border px-3" />`,
  `<button className="size-11 shrink-0 rounded-[6px] md:size-7" />`,
  `<span className="grid size-[26px] rounded-[7px] bg-muted" />`,
  `<div className="rounded-t-[10px] p-1.5" />`,
]

const CLEAN = [
  `<div className="rounded-lg border border-border px-3" />`,
  `<button className="size-11 rounded-sm md:size-7" />`,
  `<span className="size-[26px] rounded-full bg-muted" />`,
  `<div className="max-w-[680px] text-[13px]" />`,
]

test("a pixel radius literal in Coach fires", () => {
  for (const source of MISTAKES)
    assert.ok(coachRadiusLiterals(source).length > 0, source)
})

test("radius tokens and other pixel sizes stay quiet", () => {
  for (const source of CLEAN) assert.deepEqual(coachRadiusLiterals(source), [])
})

test("only Coach source files are scanned, not their tests", () => {
  assert.ok(isCoachSource("apps/web/src/features/coach/coach-panel.tsx"))
  assert.ok(!isCoachSource("apps/web/src/features/coach/coach-panel.test.tsx"))
  assert.ok(!isCoachSource("apps/web/src/features/paper/paper-page.tsx"))
})

test("Coach source keeps no pixel radius literal", () => {
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "apps/web/src/features/coach",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter(isCoachSource)
    .filter((file) => existsSync(path.join(root, file)))
  const problems = files.flatMap((file) =>
    coachRadiusLiterals(readFileSync(path.join(root, file), "utf8"), file)
  )
  assert.deepEqual(problems, [])
})
