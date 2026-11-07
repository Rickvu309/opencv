import assert from "node:assert/strict"
import test from "node:test"
import { detectCoachTurnWire } from "./lib/paper-coach-turn.mjs"

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
