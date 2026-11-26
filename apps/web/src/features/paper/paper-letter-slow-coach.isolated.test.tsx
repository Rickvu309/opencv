import type { JobView } from "@workspace/domain/apply"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import { startedChat } from "@/test/chat-fixtures.ts"
import { render } from "@/test/render-with-client.tsx"

import { ChatStoreContext } from "@/features/coach/chat-store-context.ts"

import { PaperLetterStartPage } from "./paper-letter-start-page.tsx"

const LETTER = "77777777-7777-4777-8777-777777777777"
const CHAT = "11111111-1111-4111-8111-111111111111"
const TASK = "33333333-3333-4333-8333-333333333333"
const REPLY = "44444444-4444-4444-8444-444444444444"
const USAGE = "55555555-5555-4555-8555-555555555555"
const AT = "2026-11-12T10:00:00.000Z"
const STILL_WRITING = "Coach is still writing your letter"
const OPENING = "Dear hiring team,\n\n"
const MIDDLE = "I ran the spring campaign."
const CLOSING = "\n\nI would love to talk.\n\nAna"

const job: JobView = mockJob({
  title: "Junior Marketing",
  company: "Lumière",
  updatedAt: "2026-08-25T12:00:00.000Z",
})

const { listJobs } = vi.hoisted(() => ({ listJobs: vi.fn() }))
vi.mock("@/features/apply/apply-api.ts", () => ({ listJobs }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function ok(data: unknown) {
  return Promise.resolve(Response.json({ ok: true, data }))
}

function frame(event: string, data: unknown) {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  )
}

function taskEvent(seq: number, kind: "draft" | "state", payload: unknown) {
  return {
    taskId: TASK,
    seq,
    epoch: 0,
    attempt: 0,
    step: kind === "draft" ? 0 : null,
    kind,
    payload,
    createdAt: AT,
  }
}

function snapshot(
  state: "running" | "waitingApproval" | "succeeded" | "failed",
  events: ReturnType<typeof taskEvent>[],
  reply: string | null
) {
  return {
    taskId: TASK,
    chatId: CHAT,
    state,
    sourceMessageId: null,
    assistantMessageId: reply === null ? null : REPLY,
    supersedesMessageId: null,
    cancelRequestedAt: null,
    errorCode: null,
    cursor: events.at(-1)?.seq ?? -1,
    events,
    messages:
      reply === null
        ? []
        : [
            {
              id: REPLY,
              chatId: CHAT,
              role: "coach",
              text: reply,
              parts: [{ type: "text", text: reply }],
              status: "final",
              workedMs: 41000,
              createdAt: AT,
            },
          ],
    actions: [],
    confirmations: [],
    usage: {
      id: USAGE,
      finishReason: null,
      latencyMs: null,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    },
  }
}

function installSlowCoach(ending: {
  state: "succeeded" | "failed"
  rest: string
  waiting?: boolean
}) {
  const opened = taskEvent(0, "draft", { text: OPENING })
  const written = taskEvent(1, "draft", { text: MIDDLE })
  const rest = taskEvent(2, "draft", { text: ending.rest })
  const ended = taskEvent(3, "state", { state: ending.state })
  let events: ReadableStreamDefaultController<Uint8Array> | null = null
  let following = false
  let snapshots = 0
  const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes("/api/commands/paper.create"))
      return ok({
        id: LETTER,
        name: "Cover letter, Lumière",
        kind: "letter",
        format: "rich",
      })
    if (url.includes("/api/commands/chat.create")) return ok(startedChat(CHAT))
    if (url.endsWith("/api/commands/coach.stop")) return ok({ stopped: true })
    if (url.includes("/turns")) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(frame("message-start", { chatId: CHAT }))
          controller.enqueue(frame("text-delta", { text: OPENING }))
          if (ending.waiting) {
            controller.enqueue(
              frame("tool-result", {
                toolCallId: "call_priority",
                name: "job.setPriority",
                summary: "Set a job's priority.",
                ok: true,
                result: { ok: true, data: null },
                pendingActionId: "66666666-6666-4666-8666-666666666666",
              })
            )
            controller.enqueue(
              frame("error", {
                message:
                  "Coach reconnected. Reload this Chat to see its saved reply.",
              })
            )
          } else
            controller.enqueue(
              frame("notice", {
                text: "Coach is still working. Reload this Chat to follow or stop it.",
              })
            )
          controller.enqueue(frame("message-end", { chatId: CHAT }))
          controller.close()
        },
      })
      return Promise.resolve(
        new Response(stream, {
          headers: { "Content-Type": "text/event-stream" },
        })
      )
    }
    if (url.includes(`/api/coach/tasks/${TASK}/events`)) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          events = controller
          following = true
          init?.signal?.addEventListener("abort", () => {
            following = false
            controller.error(new DOMException("Stopped", "AbortError"))
          })
        },
      })
      return Promise.resolve(
        new Response(stream, {
          headers: { "Content-Type": "text/event-stream" },
        })
      )
    }
    if (url.includes("/api/reads/coach.status")) {
      snapshots += 1
      return ok(
        snapshots === 1
          ? snapshot(
              ending.waiting ? "waitingApproval" : "running",
              [opened],
              null
            )
          : snapshot(
              ending.state,
              [opened, written, rest, ended],
              ending.state === "succeeded"
                ? OPENING + MIDDLE + ending.rest
                : null
            )
      )
    }
    if (url.endsWith("/api/reads/chat.get"))
      return ok({
        id: CHAT,
        title: "Cover letter, Lumière",
        focusKind: null,
        focusId: null,
        createdAt: AT,
        updatedAt: AT,
        messages: [],
        activeTaskId: TASK,
      })
    return ok({})
  })
  vi.stubGlobal("fetch", fetch)
  const send = (event: ReturnType<typeof taskEvent>) =>
    act(async () => {
      if (following) events?.enqueue(frame("task", event))
    })
  return {
    fetch,
    following: () => following,
    writeMiddle: () => send(written),
    approve: () => send(taskEvent(1, "state", { state: "running" })),
    finish: async () => {
      await send(rest)
      await send(ended)
    },
  }
}

function mintInputs(fetch: ReturnType<typeof installSlowCoach>["fetch"]) {
  return fetch.mock.calls
    .filter(([url]) => String(url).includes("/commands/paper."))
    .map(([url, init]) => ({
      command: String(url).split("/commands/")[1],
      input: JSON.parse(String(init?.body)).input,
    }))
}

function stopped(fetch: ReturnType<typeof installSlowCoach>["fetch"]) {
  return fetch.mock.calls.some(([url]) =>
    String(url).endsWith("/api/commands/coach.stop")
  )
}

async function draftUntilStillWriting(onCreated: () => void) {
  listJobs.mockResolvedValue([job])
  const view = render(
    <PaperLetterStartPage onBack={() => view.unmount()} onCreated={onCreated} />
  )
  fireEvent.click(
    await screen.findByRole("button", { name: "Junior Marketing, Lumière" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
  expect(await screen.findByText(STILL_WRITING)).toBeInTheDocument()
  return view
}

it("opens one page with the whole letter when the Coach finishes after 30 seconds", async () => {
  const coach = installSlowCoach({ state: "succeeded", rest: CLOSING })
  const onCreated = vi.fn()
  await draftUntilStillWriting(onCreated)
  await coach.writeMiddle()
  expect(await screen.findByText(MIDDLE)).toBeInTheDocument()
  expect(mintInputs(coach.fetch)).toEqual([])
  expect(onCreated).not.toHaveBeenCalled()
  await coach.finish()
  await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith(LETTER))
  expect(mintInputs(coach.fetch)).toEqual([
    {
      command: "paper.create",
      input: expect.objectContaining({
        kind: "letter",
        jobId: job.id,
        lines: [
          "Dear hiring team,",
          "I ran the spring campaign.",
          "I would love to talk.",
          "Ana",
        ],
      }),
    },
  ])
})

it("makes no page and offers a retry when the Coach fails after 30 seconds", async () => {
  const coach = installSlowCoach({ state: "failed", rest: CLOSING })
  const onCreated = vi.fn()
  await draftUntilStillWriting(onCreated)
  await coach.writeMiddle()
  await coach.finish()
  expect(
    await screen.findByText("Coach could not finish your letter. Try again.")
  ).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Draft letter" })).toBeEnabled()
  expect(onCreated).not.toHaveBeenCalled()
  expect(mintInputs(coach.fetch)).toEqual([])
})

it("makes no page and offers a retry when the person goes offline while the Coach writes", async () => {
  const coach = installSlowCoach({ state: "succeeded", rest: CLOSING })
  const onCreated = vi.fn()
  await draftUntilStillWriting(onCreated)
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
  await act(async () => {
    window.dispatchEvent(new Event("offline"))
  })
  expect(
    await screen.findByText(
      "You went offline while Coach was writing your letter. Try again."
    )
  ).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Draft letter" })).toBeEnabled()
  expect(onCreated).not.toHaveBeenCalled()
  expect(mintInputs(coach.fetch)).toEqual([])
})

it("keeps only the text shown when the person clicks Stop after 30 seconds", async () => {
  const coach = installSlowCoach({ state: "succeeded", rest: CLOSING })
  const onCreated = vi.fn()
  await draftUntilStillWriting(onCreated)
  await coach.writeMiddle()
  await screen.findByText(MIDDLE)
  fireEvent.click(screen.getByRole("button", { name: "Stop" }))
  await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith(LETTER))
  expect(mintInputs(coach.fetch)).toEqual([
    {
      command: "paper.create",
      input: expect.objectContaining({
        lines: ["Dear hiring team,", "I ran the spring campaign."],
      }),
    },
  ])
  expect(stopped(coach.fetch)).toBe(true)
})

it("makes nothing when the person leaves while the Coach is still writing", async () => {
  const coach = installSlowCoach({ state: "succeeded", rest: CLOSING })
  const onCreated = vi.fn()
  await draftUntilStillWriting(onCreated)
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Paper" }))
  )
  expect(coach.following()).toBe(false)
  await coach.finish()
  expect(onCreated).not.toHaveBeenCalled()
  expect(mintInputs(coach.fetch)).toEqual([])
  expect(stopped(coach.fetch)).toBe(true)
})

it("refuses a finished letter too long for one Word page save", async () => {
  const coach = installSlowCoach({
    state: "succeeded",
    rest: Array.from({ length: 100 }, (_, index) => `\n\nPoint ${index}.`).join(
      ""
    ),
  })
  const onCreated = vi.fn()
  await draftUntilStillWriting(onCreated)
  await coach.writeMiddle()
  await coach.finish()
  expect(
    await screen.findByText(
      "This letter is too long to save. Shorten it and try again."
    )
  ).toBeInTheDocument()
  expect(onCreated).not.toHaveBeenCalled()
  expect(mintInputs(coach.fetch)).toEqual([])
})

it("says the Coach waits for approval and opens its Chat, then opens the finished letter", async () => {
  const coach = installSlowCoach({
    state: "succeeded",
    rest: CLOSING,
    waiting: true,
  })
  const openChat = vi.fn()
  const onCreated = vi.fn()
  listJobs.mockResolvedValue([job])
  render(
    <ChatStoreContext.Provider value={{ openChat } as never}>
      <PaperLetterStartPage onBack={() => undefined} onCreated={onCreated} />
    </ChatStoreContext.Provider>
  )
  fireEvent.click(
    await screen.findByRole("button", { name: "Junior Marketing, Lumière" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
  expect(
    await screen.findByText("Coach is waiting for your approval in the Chat")
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Open Chat" }))
  expect(openChat).toHaveBeenCalledWith(CHAT)
  expect(mintInputs(coach.fetch)).toEqual([])
  await coach.approve()
  expect(await screen.findByText(STILL_WRITING)).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Open Chat" })).toBeNull()
  await coach.finish()
  await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith(LETTER))
  expect(mintInputs(coach.fetch)[0]?.input.lines).toEqual([
    "Dear hiring team,",
    "I ran the spring campaign.",
    "I would love to talk.",
    "Ana",
  ])
})
