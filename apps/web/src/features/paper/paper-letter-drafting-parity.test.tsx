import type { JobView } from "@workspace/domain"
import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { render } from "@/test/render-with-client.tsx"

import layout from "./design/letter-drafting.layout.json"
import { PaperLetterDraftingPage } from "./paper-letter-drafting-page.tsx"
import { PaperLetterStartPage } from "./paper-letter-start-page.tsx"

const job: JobView = {
  id: "job-1",
  title: "Junior Marketing",
  company: "Lumière",
  posting: {},
  cvDocId: null,
  letterDocId: null,
  updatedAt: "2026-08-25T12:00:00.000Z",
}

const { listJobs } = vi.hoisted(() => ({ listJobs: vi.fn() }))
vi.mock("@/features/apply/apply-api.ts", () => ({ listJobs }))

afterEach(cleanup)

it("shows pen-frame static texts in the drafting screen", () => {
  const staticTexts = layout.texts
    .map((t) => t.text)
    .filter((t) => ["Drafting", "Stop", "Coach is writing…"].includes(t))
  render(
    <PaperLetterDraftingPage
      draftName="Cover letter, Lumière"
      attribution={null}
      streamedText=""
      onStop={() => undefined}
      onBack={() => undefined}
    />
  )
  for (const text of staticTexts) {
    expect(screen.getByText(text)).toBeInTheDocument()
  }
  expect(screen.getByRole("button", { name: "Paper" })).toBeInTheDocument()
  expect(screen.getByText("Cover letters")).toBeInTheDocument()
  expect(screen.getByText("Cover letter, Lumière")).toBeInTheDocument()
})

it("shows attribution from attached file when provided", () => {
  render(
    <PaperLetterDraftingPage
      draftName="Cover letter"
      attribution="From role-description.pdf"
      streamedText=""
      onStop={() => undefined}
      onBack={() => undefined}
    />
  )
  expect(screen.getByText("From role-description.pdf")).toBeInTheDocument()
})

it("does not show attribution when none is provided", () => {
  render(
    <PaperLetterDraftingPage
      draftName="Cover letter"
      attribution={null}
      streamedText=""
      onStop={() => undefined}
      onBack={() => undefined}
    />
  )
  expect(screen.queryByText(/^From /)).not.toBeInTheDocument()
})

it("shows streamed text in the card", () => {
  render(
    <PaperLetterDraftingPage
      draftName="Cover letter"
      attribution={null}
      streamedText="Dear hiring team,"
      onStop={() => undefined}
      onBack={() => undefined}
    />
  )
  expect(screen.getByText("Dear hiring team,")).toBeInTheDocument()
})

it("calls onStop when Stop is clicked", () => {
  const onStop = vi.fn()
  render(
    <PaperLetterDraftingPage
      draftName="Cover letter"
      attribution={null}
      streamedText=""
      onStop={onStop}
      onBack={() => undefined}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: "Stop" }))
  expect(onStop).toHaveBeenCalledOnce()
})

it("calls onBack when Paper breadcrumb is clicked", () => {
  const onBack = vi.fn()
  render(
    <PaperLetterDraftingPage
      draftName="Cover letter"
      attribution={null}
      streamedText=""
      onStop={() => undefined}
      onBack={onBack}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: "Paper" }))
  expect(onBack).toHaveBeenCalledOnce()
})

function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

function fail(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status })
}

function installFetch(mode: "stream" | "stop" | "error") {
  const letter = {
    id: "letter-1",
    name: "Cover letter, Lumière",
    kind: "letter",
    templateId: "simple",
    status: "draft",
    document: { markdown: "" },
    contentVersion: 1,
    checks: [],
    pageChoice: "unset",
    isFavorite: false,
    sourceFileId: null,
    createdAt: "2026-08-25T12:00:00.000Z",
    updatedAt: "2026-08-25T12:00:00.000Z",
  }
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes("/api/commands/paper.create"))
      return Promise.resolve(ok(letter))
    if (url.includes("/api/commands/chat.create"))
      return Promise.resolve(ok({ id: "chat-1" }))
    if (url.includes("/api/paper/letter-1")) return Promise.resolve(ok(letter))
    if (url.includes("/stop")) return Promise.resolve(ok({}))
    if (url.includes("/turns")) {
      if (mode === "error") {
        return Promise.resolve(
          fail(500, "SERVER_ERROR", "Something went wrong.")
        )
      }
      if (mode === "stop") {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
          })
        })
      }
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              [
                'event: text-delta\ndata: {"text":"Dear hiring team,"}\n\n',
                'event: tool-call\ndata: {"toolCallId":"c1","name":"paper.replace","input":{"docId":"letter-1","contentVersion":1,"document":{"markdown":"Dear hiring team,"}}}\n\n',
                'event: tool-result\ndata: {"toolCallId":"c1","name":"paper.replace","summary":"Updated","ok":true,"result":{"ok":true,"data":{}}}\n\n',
              ].join("")
            )
          )
          controller.close()
        },
      })
      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
      )
    }
    return Promise.resolve(ok({}))
  })
}

it("shows the drafting overlay when a draft starts", async () => {
  installFetch("stop")
  listJobs.mockResolvedValue([job])
  render(
    <PaperLetterStartPage
      onBack={() => undefined}
      onCreated={() => undefined}
    />
  )
  fireEvent.click(
    await screen.findByRole("button", { name: "Junior Marketing, Lumière" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
  expect(await screen.findByText("Coach is writing…")).toBeInTheDocument()
  expect(screen.getByText("Drafting")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument()
})

it("calls onCreated after stream completes and removes the overlay", async () => {
  installFetch("stream")
  listJobs.mockResolvedValue([job])
  const onCreated = vi.fn()
  render(
    <PaperLetterStartPage onBack={() => undefined} onCreated={onCreated} />
  )
  fireEvent.click(
    await screen.findByRole("button", { name: "Junior Marketing, Lumière" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
  await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith("letter-1"))
  expect(screen.queryByText("Coach is writing…")).not.toBeInTheDocument()
})

it("stops the draft from the drafting overlay Stop button", async () => {
  installFetch("stop")
  listJobs.mockResolvedValue([job])
  render(
    <PaperLetterStartPage
      onBack={() => undefined}
      onCreated={() => undefined}
    />
  )
  fireEvent.click(
    await screen.findByRole("button", { name: "Junior Marketing, Lumière" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
  const stopBtn = await screen.findByRole("button", { name: "Stop" })
  fireEvent.click(stopBtn)
  await vi.waitFor(() =>
    expect(screen.queryByText("Coach is writing…")).not.toBeInTheDocument()
  )
  expect(
    screen.getByRole("heading", { name: "Start a cover letter" })
  ).toBeInTheDocument()
})

it("returns form after a draft error and shows the error message", async () => {
  installFetch("error")
  listJobs.mockResolvedValue([job])
  render(
    <PaperLetterStartPage
      onBack={() => undefined}
      onCreated={() => undefined}
    />
  )
  fireEvent.click(
    await screen.findByRole("button", { name: "Junior Marketing, Lumière" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
  await screen.findByText("Coach is writing…")
  await vi.waitFor(() =>
    expect(screen.queryByText("Coach is writing…")).not.toBeInTheDocument()
  )
  expect(screen.getByText("Something went wrong.")).toBeInTheDocument()
})
