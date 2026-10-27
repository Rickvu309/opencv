import type { JobView, PaperView } from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"
import { render } from "@/test/render-with-client.tsx"

import { PaperLetterEditor, PaperLetterStart } from "./paper-letter.tsx"

const job: JobView = {
  id: "job-1",
  title: "Associate PM",
  company: "Northwind",
  posting: { requirements: "The role needs Meta Ads" },
  cvDocId: null,
  letterDocId: null,
  updatedAt: "2026-08-25T12:00:00.000Z",
}

const letter: PaperView = {
  id: "letter-1",
  name: "Cover letter, Northwind",
  kind: "letter",
  templateId: "simple",
  status: "draft",
  document: { markdown: "I write clearly." },
  contentVersion: 1,
  checks: [],
  pageChoice: "unset",
  sourceFileId: null,
  createdAt: "2026-08-25T12:00:00.000Z",
  updatedAt: "2026-08-25T12:00:00.000Z",
}

type Call = { url: string; body: unknown }

function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

function fail(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status })
}

function installFetch(mode: "tool" | "stop" | "limit") {
  const calls: Call[] = []
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null
    calls.push({ url, body })
    if (url.includes("/api/commands/paper.create"))
      return Promise.resolve(ok(letter))
    if (url.includes("/api/commands/chat.create")) {
      return Promise.resolve(ok({ id: "chat-1" }))
    }
    if (url.includes("/api/paper/letter-1")) return Promise.resolve(ok(letter))
    if (url.includes("/stop")) return Promise.resolve(ok({}))
    if (url.includes("/api/coach/usage")) {
      return Promise.resolve(ok({ resetsAt: "2026-10-28T09:00:00.000Z" }))
    }
    if (url.includes("/turns")) {
      if (mode === "limit") {
        return Promise.resolve(
          fail(429, "RATE_LIMITED", "Try again in the morning.")
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
                'event: text-delta\ndata: {"text":"Dear team"}\n\n',
                'event: tool-call\ndata: {"toolCallId":"c1","name":"paper.replace","input":{"docId":"letter-1","contentVersion":1,"document":{"markdown":"Dear team"}}}\n\n',
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
  return calls
}

function start() {
  render(
    <PaperLetterStart
      jobs={[job]}
      cvName="PM track CV"
      onCreated={() => undefined}
      onImport={() => undefined}
    />
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Associate PM, Northwind" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Cover letter", () => {
  it("drafts with the job title and refetches on a paper replace tool result", async () => {
    const calls = installFetch("tool")
    start()
    await vi.waitFor(() => {
      expect(
        calls.some((call) => call.url.includes("/api/paper/letter-1"))
      ).toBe(true)
    })
    expect(calls.find((call) => call.url.includes("/turns"))?.body).toEqual(
      expect.objectContaining({
        text: "Draft a cover letter for Associate PM at Northwind.",
        focusDocId: "letter-1",
      })
    )
    expect(
      calls.some((call) => call.url.includes("/api/commands/paper.replace"))
    ).toBe(false)
  })

  it("stops the stream", async () => {
    const calls = installFetch("stop")
    start()
    fireEvent.click(await screen.findByRole("button", { name: "Stop" }))
    await vi.waitFor(() => {
      expect(
        calls.some((call) => call.url.includes("/api/chats/chat-1/stop"))
      ).toBe(true)
    })
  })

  it("shows the Free limit after a 429", async () => {
    installFetch("limit")
    start()
    expect(
      await screen.findByText("You've reached today's Free limit.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /^Coach is back at / })
    ).toBeDisabled()
  })

  it("offers Add to letter for a Meta Ads gap and Skip closes the card", () => {
    render(
      <PaperLetterEditor
        doc={letter}
        job={job}
        cvName="PM track CV"
        onBack={() => undefined}
      />
    )
    expect(screen.getByText(/The job asks for Meta/)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Add to letter" })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    expect(
      screen.queryByRole("button", { name: "Add to letter" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Skip" })
    ).not.toBeInTheDocument()
  })
})
