import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import {
  detectCoachTurnWire,
  detectPendingDeadline,
} from "./lib/paper-coach-turn.mjs"

const wireMistake = `
await writeChatEvent(
  stream,
  toolResultFromExecute({
    toolCallId: action.toolCallId,
    name,
    summary,
    result: receipt.result,
  })
)
`

const wireClean = `
const event = eventForPart(
  toolResultFromExecute({
    toolCallId: action.toolCallId,
    name,
    summary,
    result: receipt.result,
  })
)
if (event) await writeChatEvent(stream, event)
`

test("turn wire guard fires when the raw result is written and stays quiet when the event is built first", () => {
  assert.equal(detectCoachTurnWire(wireMistake).length, 1)
  assert.equal(detectCoachTurnWire(wireClean).length, 0)
})

test("pending-result replay controls its clock and closes its stream", () => {
  const mistake = `it("sends a pending result the old tab can read", async () => {
    const wire = response.text()
    await work()
    expect(await wire).toContain("event: confirm")
  })`
  const clean = `it("sends a pending result the old tab can read", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(0)
    await reader.read()
    await reader.cancel()
  })`
  assert.equal(detectPendingDeadline(mistake).length, 1)
  assert.deepEqual(detectPendingDeadline(clean), [])
  assert.deepEqual(
    detectPendingDeadline(
      readFileSync(
        new URL(
          "../apps/api/src/coach/turn-compatibility.test.ts",
          import.meta.url
        ),
        "utf8"
      )
    ),
    []
  )
})
