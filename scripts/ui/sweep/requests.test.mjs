import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import test from "node:test"

import {
  DEFAULT_BUDGET,
  budgetFor,
  requestProblems,
  requestRecorder,
} from "./requests.mjs"

const record = (method, url, phase, at = 0) => ({ method, url, phase, at })
const many = (count, method, url, phase, spacing = 10) =>
  Array.from({ length: count }, (_, at) =>
    record(method, url, phase, at * spacing)
  )

const D28_SAVE_LOOP = {
  from: "PR 1426 round 3, D28: one refused line plus one new line starts an endless save loop, 164 requests in 33 s while idle",
  log: [
    ...many(6, "GET", "/api/paper/packages/doc-1/read", "load").map(
      (item, at) => ({ ...item, url: `${item.url}?part=${at}` })
    ),
    ...many(15, "POST", "/api/paper/packages/doc-1/edits", "idle", 201),
  ],
}

const D71_LIST_STORM = {
  from: "PR 1451 round 1, D71: a missing, stranger's or deleted id shows Loading documents forever with about 60 GET /api/paper a second",
  log: [
    ...many(24, "GET", "/api/paper", "load", 16),
    ...many(180, "GET", "/api/paper", "idle", 16),
  ],
}

const MAIN_LOGS = new URL("./fixtures/", import.meta.url)

test("a screen that makes more than 30 requests while it opens fails", () => {
  const log = Array.from({ length: 31 }, (_, at) =>
    record("GET", `/api/item/${at}`, "load")
  )
  assert.match(
    requestProblems(log, DEFAULT_BUDGET).join("\n"),
    /31 requests while the screen opened, over the budget of 30/
  )
})

test("the same GET four times while opening fails, three times passes", () => {
  assert.deepEqual(
    requestProblems(many(4, "GET", "/api/paper", "load"), DEFAULT_BUDGET),
    [
      "requests did not settle: GET /api/paper ran 4 times while the screen opened, over 3",
    ]
  )
  assert.deepEqual(
    requestProblems(many(3, "GET", "/api/paper", "load"), DEFAULT_BUDGET),
    []
  )
})

test("more than one request in the idle window fails, one passes", () => {
  assert.match(
    requestProblems(many(2, "GET", "/api/jobs", "idle"), DEFAULT_BUDGET).join(
      "\n"
    ),
    /2 requests in the 3 s after the screen settled, over 1 \(most: GET \/api\/jobs x2\)/
  )
  assert.deepEqual(
    requestProblems(many(1, "GET", "/api/jobs", "idle"), DEFAULT_BUDGET),
    []
  )
})

test("a declared poller may ask while idle, and other paths still count", () => {
  const budget = budgetFor("coach-chat-streaming", {
    "coach-chat-streaming": { pollers: ["/api/coach/tasks/current"] },
  })
  assert.deepEqual(
    requestProblems(
      many(3, "GET", "/api/coach/tasks/current?after=4", "idle"),
      budget
    ),
    []
  )
  assert.equal(
    requestProblems(
      [
        ...many(3, "GET", "/api/coach/tasks/current", "idle"),
        ...many(2, "GET", "/api/paper", "idle"),
      ],
      budget
    ).length,
    1
  )
})

test("a screen with no entry gets the default budget", () => {
  assert.deepEqual(budgetFor("paper-home", {}), DEFAULT_BUDGET)
})

for (const fixture of [D28_SAVE_LOOP, D71_LIST_STORM])
  test(`the recorded storm fires: ${fixture.from}`, () => {
    assert.ok(requestProblems(fixture.log, DEFAULT_BUDGET).length > 0)
  })

test("request logs recorded on main stay quiet", () => {
  const names = readdirSync(MAIN_LOGS).filter((name) =>
    name.startsWith("main-requests-")
  )
  assert.ok(names.length > 0)
  for (const name of names) {
    const { screen, log } = JSON.parse(
      readFileSync(new URL(name, MAIN_LOGS), "utf8")
    )
    assert.deepEqual(requestProblems(log, budgetFor(screen)), [], name)
  }
})

test("the recorder keeps API requests only, skips preflights, and stops when done", () => {
  let clock = 100
  const recorder = requestRecorder({
    apiOrigin: "http://localhost:4467",
    now: () => clock,
  })
  const request = (method, url) => ({ method: () => method, url: () => url })
  recorder.onRequest(request("GET", "http://localhost:4467/api/paper?x=1"))
  recorder.onRequest(request("GET", "http://localhost:5467/src/main.tsx"))
  recorder.onRequest(request("OPTIONS", "http://localhost:4467/api/paper"))
  clock = 400
  recorder.setPhase("idle")
  recorder.onRequest(request("POST", "http://localhost:4467/api/chats"))
  recorder.setPhase("done")
  recorder.onRequest(request("GET", "http://localhost:4467/api/jobs"))
  assert.deepEqual(recorder.log, [
    { method: "GET", url: "/api/paper?x=1", at: 0, phase: "load" },
    { method: "POST", url: "/api/chats", at: 300, phase: "idle" },
  ])
})
