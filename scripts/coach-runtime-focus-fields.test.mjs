import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  CONSUMER_FILE,
  RUNTIME_FILE,
  detect,
} from "./lib/coach-runtime-focus-fields.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const ENGINE_FOCUS_READ_BUT_STRIPPED = "6acc6b57e"

const CONSUMER = `
export function fakePaperEdit(
  focus: Pick<
    CoachFocusDoc,
    "id" | "revision" | "outline" | "nativeBasis" | "engine"
  >
) {
  if (focus.engine === 2) return fakeEngineTwoEdit(focus)
}
`

const runtime = (fields) => `
const contextSchema = z.object({
  messages: modelMessageSchema.array(),
  focusDoc: z
    .object({
${fields}
    })
    .optional(),
  context: z.array(z.object({ kind: z.string(), id: z.string() })).optional(),
})
`

const STRIPS_ENGINE = runtime(`      id: z.string(),
      revision: z.number(),
      outline: z.string(),
      nativeBasis: nativeBasisSchema.optional(),`)

const KEEPS_ENGINE = runtime(`      id: z.string(),
      revision: z.number(),
      outline: z.string(),
      nativeBasis: nativeBasisSchema.optional(),
      engine: z.literal(2).optional(),`)

const files = (runtimeSource) => ({
  read: (name) =>
    name === CONSUMER_FILE
      ? CONSUMER
      : name === RUNTIME_FILE
        ? runtimeSource
        : null,
})

test("a runtime focus schema that drops a field the fake Coach reads fires", () => {
  const problems = detect(STRIPS_ENGINE, RUNTIME_FILE, files(STRIPS_ENGINE))
  assert.equal(problems.length, 1)
  assert.match(problems[0], /without "engine"/)
})

test("a runtime focus schema that keeps every field the fake Coach reads stays quiet", () => {
  assert.deepEqual(detect(KEEPS_ENGINE, RUNTIME_FILE, files(KEEPS_ENGINE)), [])
})

test("nested object keys inside the focus schema do not count as kept fields", () => {
  const nested = runtime(`      id: z.string(),
      revision: z.number(),
      outline: z.string(),
      nativeBasis: z.object({ engine: z.number() }).optional(),`)
  assert.equal(detect(nested, RUNTIME_FILE, files(nested)).length, 1)
})

test("the commit where the fake Coach began reading engine fires", () => {
  const show = (name) => {
    try {
      return execFileSync(
        "git",
        ["show", `${ENGINE_FOCUS_READ_BUT_STRIPPED}:${name}`],
        { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
      )
    } catch {
      return null
    }
  }
  const problems = detect(show(RUNTIME_FILE), RUNTIME_FILE, { read: show })
  assert.equal(problems.length, 1)
})

test("the runtime focus schema keeps every field the fake Coach reads today", () => {
  assert.deepEqual(
    detect(readFileSync(path.join(root, RUNTIME_FILE), "utf8")),
    []
  )
})
