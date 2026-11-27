import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { detect } from "./lib/paper-create-start-lines.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const CREATE = "apps/api/src/paper/operations/create/server.ts"
const STARTED_BLANK = "79113af48"

const MISTAKE = `
import { paperEngineBlank } from "@workspace/domain/paper-doc"
export const implementation = {
  execute: async (input) => {
    const created = await createPaper(input)
    admitted(
      await engineLog.start(
        created.id,
        input.kind === "cv"
          ? paperEngineBlank.blankCv()
          : paperEngineBlank.blankLetter()
      )
    )
    return created
  },
}
`

const CLEAN = `
import { paperEngineBlank, templateLines } from "@workspace/domain/paper-doc"
function startingPage(input) {
  const blank =
    input.kind === "cv" ? paperEngineBlank.blankCv() : paperEngineBlank.blankLetter()
  const content = blocksFromLines(
    input.templateId
      ? templateLines(input.templateId)
      : (input.lines ?? []).map((text) => ({ style: "Normal", text }))
  )
  return content.length ? { ...blank, content } : blank
}
export const implementation = {
  execute: async (input) => {
    const created = await createPaper(input)
    admitted(await engineLog.start(created.id, startingPage(input)))
    return created
  },
}
`

const TEMPLATE_ONLY = `
function startingPage(input) {
  return blocksFromLines(input.templateId ? templateLines(input.templateId) : [])
}
export const implementation = {
  execute: async (input) => {
    admitted(await engineLog.start(created.id, startingPage(input)))
  },
}
`

test("a create that starts the log from a blank page fires", () => {
  const problems = detect(MISTAKE, CREATE)
  assert.ok(problems.some((problem) => /from a blank page/.test(problem)))
})

test("a create that reads templates but not drafted lines fires", () => {
  const problems = detect(TEMPLATE_ONLY, CREATE)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /without input\.lines/)
})

test("a create that starts the log from the template or drafted lines stays quiet", () => {
  assert.deepEqual(detect(CLEAN, CREATE), [])
})

test("files other than the create operation stay quiet", () => {
  assert.deepEqual(detect(MISTAKE, "apps/api/src/paper/engine-import.ts"), [])
})

test("the commit that first started the log from a blank page fires", () => {
  const past = execFileSync("git", ["show", `${STARTED_BLANK}:${CREATE}`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
  assert.ok(detect(past, CREATE).length > 0)
})

test("paper.create starts a new Paper from its template or drafted lines", () => {
  assert.deepEqual(
    detect(readFileSync(path.join(root, CREATE), "utf8"), CREATE),
    []
  )
})
