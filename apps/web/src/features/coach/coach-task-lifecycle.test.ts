import { expect, it } from "vitest"
import { parseChatId } from "@workspace/domain"
import { CHAT, TASK, taskSnapshot } from "@/test/coach-task-fixture.ts"
import { taskFromSnapshot } from "@/lib/coach-task-state.ts"
import {
  coachTaskLifecycleReducer as reduce,
  idleCoachTask,
  type CoachTaskLifecycle,
  type CoachTaskLifecycleEvent,
} from "./coach-task-lifecycle.ts"

const request = {
  text: "Prepare",
  sendOptions: {},
  regenerate: false,
  startKey: TASK,
}
const input = { chatId: CHAT, text: "Prepare" }
const unsent = reduce(idleCoachTask, { type: "send", request })
const generation = unsent.generation
const sent = reduce(unsent, {
  type: "startSent",
  generation,
  startKey: TASK,
  input,
})
const lost = reduce(sent, {
  type: "startLost",
  generation,
  startKey: TASK,
  error: "lost",
})
const running = reduce(sent, {
  type: "startAccepted",
  generation,
  startKey: TASK,
  taskId: TASK,
})
const stopping = reduce(running, { type: "stopPressed", generation })
const stoppedStart = reduce(sent, { type: "stopPressed", generation })
const lostStoppedStart = reduce(lost, { type: "stopPressed", generation })
const terminal = reduce(running, {
  type: "snapshot",
  generation,
  task: taskFromSnapshot(taskSnapshot({ state: "succeeded" })),
})
const idle = { ...idleCoachTask, generation }
const events: CoachTaskLifecycleEvent[] = [
  { type: "send", request },
  { type: "startSent", generation, startKey: TASK, input },
  { type: "startAccepted", generation, startKey: TASK, taskId: TASK },
  { type: "startLost", generation, startKey: TASK, error: "lost" },
  { type: "recovered", generation, taskId: TASK, chatId: CHAT },
  { type: "stopPressed", generation },
  { type: "stopFailed", generation, taskId: TASK, error: "failed" },
  { type: "snapshot", generation, task: taskFromSnapshot(taskSnapshot()) },
  {
    type: "snapshot",
    generation,
    task: taskFromSnapshot(taskSnapshot({ state: "cancelled" })),
  },
  { type: "detach" },
]
const table: Array<[string, CoachTaskLifecycle, string[]]> = [
  [
    "idle",
    idle,
    [
      "starting",
      "idle",
      "idle",
      "idle",
      "running",
      "idle",
      "idle",
      "idle",
      "idle",
      "idle",
    ],
  ],
  [
    "unsent",
    unsent,
    [
      "starting",
      "starting",
      "starting",
      "idle",
      "starting",
      "idle",
      "starting",
      "starting",
      "starting",
      "idle",
    ],
  ],
  [
    "sent",
    sent,
    [
      "starting",
      "starting",
      "running",
      "starting",
      "starting",
      "starting",
      "starting",
      "starting",
      "starting",
      "idle",
    ],
  ],
  [
    "lost",
    lost,
    [
      "starting",
      "starting",
      "starting",
      "starting",
      "starting",
      "starting",
      "starting",
      "starting",
      "starting",
      "idle",
    ],
  ],
  [
    "stop latched",
    stoppedStart,
    [
      "starting",
      "starting",
      "stopping",
      "starting",
      "starting",
      "starting",
      "starting",
      "starting",
      "starting",
      "idle",
    ],
  ],
  [
    "lost stop latched",
    lostStoppedStart,
    [
      "starting",
      "starting",
      "starting",
      "starting",
      "starting",
      "starting",
      "starting",
      "starting",
      "starting",
      "idle",
    ],
  ],
  [
    "running",
    running,
    [
      "running",
      "running",
      "running",
      "running",
      "running",
      "stopping",
      "running",
      "running",
      "terminal",
      "idle",
    ],
  ],
  [
    "stopping",
    stopping,
    [
      "stopping",
      "stopping",
      "stopping",
      "stopping",
      "stopping",
      "stopping",
      "running",
      "stopping",
      "terminal",
      "idle",
    ],
  ],
  [
    "terminal",
    terminal,
    [
      "starting",
      "terminal",
      "terminal",
      "terminal",
      "terminal",
      "terminal",
      "terminal",
      "terminal",
      "terminal",
      "idle",
    ],
  ],
]
for (const state of ["failed", "cancelled"] as const)
  table.push([
    state,
    reduce(running, {
      type: "snapshot",
      generation,
      task: taskFromSnapshot(taskSnapshot({ state })),
    }),
    table[table.length - 1][2],
  ])
for (const [name, state, expected] of table)
  it.each(
    events.map((event, index) => ({
      event,
      expected: expected[index],
      name: event.type,
      index,
    }))
  )(`${name}: $name $index → $expected`, ({ event, expected }) => {
    expect(reduce(state, event).kind).toBe(expected)
  })

it.each(table)("%s ignores all stale generations", (_, state) => {
  for (const event of events)
    if ("generation" in event)
      expect(reduce(state, { ...event, generation: generation - 1 })).toBe(
        state
      )
})

it.each(table)("%s ignores foreign start keys and task ids", (_, state) => {
  const foreign = "01900000-0000-7000-8000-000000000099"
  for (const event of events) {
    if ("startKey" in event)
      expect(reduce(state, { ...event, startKey: foreign })).toBe(state)
    if (event.type === "snapshot")
      expect(
        reduce(state, {
          ...event,
          task: taskFromSnapshot(taskSnapshot({ taskId: foreign })),
        })
      ).toBe(state)
    if (event.type === "stopFailed")
      expect(reduce(state, { ...event, taskId: foreign })).toBe(state)
  }
})

it("retains exact recovery input and releases a detached start with a new generation", () => {
  expect(lost).toMatchObject({
    kind: "starting",
    delivery: { kind: "lost", input },
    request,
  })
  expect(reduce(stoppedStart, { type: "stopPressed", generation })).toBe(
    stoppedStart
  )
  expect(reduce(stopping, { type: "stopPressed", generation })).toBe(stopping)
  expect(reduce(terminal, { type: "stopPressed", generation })).toBe(terminal)
  const detached = reduce(stoppedStart, { type: "detach" })
  const next = reduce(detached, {
    type: "send",
    request: { ...request, startKey: CHAT },
  })
  expect(next.generation).toBeGreaterThan(generation)
  expect(
    reduce(next, {
      type: "startAccepted",
      startKey: TASK,
      taskId: TASK,
      generation,
    })
  ).toBe(next)
  expect(
    reduce(terminal, {
      type: "recovered",
      generation,
      taskId: CHAT,
      chatId: parseChatId(CHAT),
    })
  ).toMatchObject({ kind: "running", taskId: CHAT })
})

const failedTerminal = reduce(terminal, {
  type: "stopFailed",
  generation,
  taskId: TASK,
  error: "offline",
})
it.each(["stopPressed", "stopSucceeded", "stopFailed"] as const)(
  "terminal cancellation Retry remains terminal after %s and admits Send",
  (type) => {
    const retried = reduce(failedTerminal, { type: "stopPressed", generation })
    const next = reduce(retried, {
      type,
      generation,
      taskId: TASK,
      error: "offline",
    })
    expect(next.kind).toBe("terminal")
    expect(reduce(next, { type: "send", request }).kind).toBe("starting")
  }
)
