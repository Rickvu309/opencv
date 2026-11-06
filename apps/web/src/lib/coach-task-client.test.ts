import { QueryClient } from "@tanstack/react-query"
import { afterEach, expect, it, vi } from "vitest"
import { tailCoachTask, subscribeCoachTask } from "./coach-task-client.ts"
import { taskSnapshot, taskEvent, TASK } from "@/test/coach-task-fixture.ts"
import type { CoachTaskState } from "./coach-task-state.ts"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
const json = (data: unknown) => Response.json({ ok: true, data })
const sse = (event: string, data: unknown) =>
  new Response(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

it("recovers a terminal reply after a connection ends without a terminal event", async () => {
  vi.useFakeTimers()
  const snapshots = [
    taskSnapshot(),
    taskSnapshot({ state: "succeeded", cursor: 1 }),
  ]
  const fetch = vi.fn(async (url: URL) =>
    url.pathname.endsWith("events") ? new Response("") : json(snapshots.shift())
  )
  vi.stubGlobal("fetch", fetch)
  const seen: CoachTaskState[] = []
  const tail = tailCoachTask({
    queryClient: new QueryClient(),
    taskId: TASK,
    signal: new AbortController().signal,
    onState: (state) => seen.push(state),
  })
  await vi.runAllTimersAsync()
  await tail
  expect(seen.at(-1)?.snapshot.state).toBe("succeeded")
  expect(seen.some((state) => state.reconnecting)).toBe(true)
  expect(fetch).toHaveBeenCalledTimes(3)
})

it("repairs an SSE gap with a snapshot and never applies the skipped delta", async () => {
  const terminal = taskSnapshot({ state: "cancelled", cursor: 3 })
  let snapshotReads = 0
  vi.stubGlobal("fetch", async (url: URL) =>
    url.pathname.endsWith("events")
      ? sse("task", taskEvent(3, "wrong"))
      : json(snapshotReads++ ? terminal : taskSnapshot())
  )
  const seen: CoachTaskState[] = []
  await tailCoachTask({
    queryClient: new QueryClient(),
    taskId: TASK,
    signal: new AbortController().signal,
    onState: (state) => seen.push(state),
  })
  expect(seen.at(-1)?.snapshot.state).toBe("cancelled")
  expect(seen.every((state) => !state.draft.includes("wrong"))).toBe(true)
})

it("accepts reset snapshots and shares one tail until its final subscriber leaves", async () => {
  const terminal = taskSnapshot({ state: "succeeded", cursor: 4 })
  const fetch = vi.fn(async (url: URL) =>
    url.pathname.endsWith("events")
      ? sse("reset", { type: "reset", reason: "gap", snapshot: terminal })
      : json(taskSnapshot())
  )
  vi.stubGlobal("fetch", fetch)
  const client = new QueryClient()
  let resolve!: () => void
  const done = new Promise<void>((complete) => {
    resolve = complete
  })
  const one = subscribeCoachTask(client, TASK, (state) => {
    if (state.snapshot.state === "succeeded") resolve()
  })
  const two = subscribeCoachTask(client, TASK, () => {})
  await done
  expect(fetch).toHaveBeenCalledTimes(2)
  one()
  two()
})

it("requests exactly after the snapshot cursor and deduplicates replay before completion", async () => {
  const initial = taskSnapshot({ cursor: 4, events: [taskEvent(4, "Saved")] })
  const terminal = taskSnapshot({ state: "succeeded", cursor: 6 })
  let reads = 0
  const fetch = vi.fn(async (url: URL) =>
    url.pathname.endsWith("events")
      ? new Response(
          [
            taskEvent(5, " reply"),
            taskEvent(5, " reply"),
            taskEvent(6, "", {
              kind: "state",
              payload: { state: "succeeded" },
            }),
          ]
            .map((event) => `event: task\ndata: ${JSON.stringify(event)}\n\n`)
            .join("")
        )
      : json(reads++ ? terminal : initial)
  )
  vi.stubGlobal("fetch", fetch)
  const seen: CoachTaskState[] = []
  await tailCoachTask({
    queryClient: new QueryClient(),
    taskId: TASK,
    signal: new AbortController().signal,
    onState: (state) => seen.push(state),
  })
  expect(
    fetch.mock.calls
      .find(([url]) => url.pathname.endsWith("events"))?.[0]
      .searchParams.get("after")
  ).toBe("4")
  expect(
    seen.filter((state) => state.cursor === 5).map((state) => state.draft)
  ).toEqual(["Saved reply", "Saved reply"])
  expect(seen.at(-1)?.snapshot.state).toBe("succeeded")
})

it("refreshes command reads from a committed snapshot without a preceding live tool call", async () => {
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, "invalidateQueries")
  vi.stubGlobal("fetch", async () =>
    json(
      taskSnapshot({
        state: "succeeded",
        actions: [
          {
            step: 0,
            slot: 0,
            toolCallId: "saved-call",
            operation: "job.setPriority",
            input: { jobId: TASK, priority: "high" },
            state: "committed",
            proposalId: null,
            activityId: TASK,
            result: {},
            errorCode: null,
          },
        ],
      })
    )
  )
  await tailCoachTask({
    queryClient: client,
    taskId: TASK,
    signal: new AbortController().signal,
    onState() {},
  })
  expect(invalidate.mock.calls).toContainEqual([{ queryKey: ["job.list"] }])
  expect(invalidate.mock.calls).toContainEqual([
    { queryKey: ["job.get", { jobId: TASK }] },
  ])
})
