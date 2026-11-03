import type { JobView, PaperView } from "@workspace/domain"
import { vi } from "vitest"
import { fireEvent, screen } from "@testing-library/react"

import { PaperLetterStart } from "@/features/paper/paper-letter.tsx"

import { render } from "./render-with-client.tsx"

export const job: JobView = {
  id: "job-1",
  title: "Associate PM",
  company: "Northwind",
  posting: { requirements: "The role needs Meta Ads" },
  cvDocId: null,
  letterDocId: null,
  updatedAt: "2026-08-25T12:00:00.000Z",
}

export const letter: PaperView = {
  id: "letter-1",
  name: "Cover letter, Northwind",
  kind: "letter",
  templateId: "simple",
  status: "draft",
  document: { markdown: "I write clearly." },
  contentVersion: 1,
  checks: [],
  pageChoice: "unset",
  isFavorite: false,
  sourceFileId: null,
  createdAt: "2026-08-25T12:00:00.000Z",
  updatedAt: "2026-08-25T12:00:00.000Z",
}

type Call = { url: string; body: unknown }

export function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

export function fail(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status })
}

export function installFetch(mode: "tool" | "stop" | "limit") {
  const calls: Call[] = []
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null
    calls.push({ url, body })
    if (url.includes("/api/paper/letter-attachment"))
      return Promise.resolve(
        ok({
          name: "role-description.txt",
          text: "Lead customer research and delivery.",
          truncated: false,
        })
      )
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

export function startDrafting() {
  render(
    <PaperLetterStart
      jobs={[job]}

      onCreated={() => undefined}
    />
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Associate PM, Northwind" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
}
