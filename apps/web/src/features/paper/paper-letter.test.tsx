import type { JobView, PaperView } from "@workspace/domain"
import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
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
  isFavorite: false,
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
    if (url.includes("/api/paper/letter-attachment"))
      return Promise.resolve(
        ok({
          name: "job.txt",
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

function start() {
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

afterEach(() => {
  document.body.removeAttribute("data-print")
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("Cover letter", () => {
  it("explains the required context and enables drafting for job text or a selected job", () => {
    const calls = installFetch("tool")
    render(<PaperLetterStart jobs={[job]} onCreated={() => undefined} />)
    const draft = screen.getByRole("button", { name: "Draft letter" })
    const input = screen.getByRole("textbox")
    expect(draft).toBeDisabled()
    expect(draft).toHaveAccessibleDescription(
      "Choose a job, paste job text or a link, or attach a file to draft a letter."
    )
    fireEvent.click(draft)
    expect(calls).toEqual([])
    fireEvent.change(input, { target: { value: "  \n " } })
    expect(draft).toBeDisabled()
    fireEvent.change(input, { target: { value: "We need a product manager." } })
    expect(draft).toBeEnabled()
    fireEvent.change(input, { target: { value: "https://example.com/job" } })
    expect(draft).toBeEnabled()
    fireEvent.change(input, { target: { value: "" } })
    expect(draft).toBeDisabled()
    fireEvent.click(
      screen.getByRole("button", { name: "Associate PM, Northwind" })
    )
    expect(draft).toBeEnabled()
  })

  it("keeps an upload as Letter context and sends its text without creating a CV", async () => {
    const calls = installFetch("tool")
    const onCreated = vi.fn()
    render(<PaperLetterStart jobs={[]} onCreated={onCreated} />)
    const file = new File(["Lead customer research and delivery."], "job.txt", {
      type: "text/plain",
    })
    fireEvent.change(screen.getByLabelText("Attach letter context"), {
      target: { files: [file] },
    })
    await screen.findByText("Context: job.txt")
    expect(onCreated).not.toHaveBeenCalled()
    expect(calls.filter((call) => call.url.includes("/commands/"))).toEqual([])
    expect(screen.queryByText(/From CV/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
    await vi.waitFor(() =>
      expect(calls.some((call) => call.url.includes("/turns"))).toBe(true)
    )
    expect(calls.find((call) => call.url.includes("/turns"))?.body).toEqual(
      expect.objectContaining({
        text: expect.stringContaining("Lead customer research and delivery."),
      })
    )
    expect(
      calls.find((call) => call.url.includes("/paper.create"))?.body
    ).toEqual(
      expect.objectContaining({
        input: expect.objectContaining({ kind: "letter" }),
      })
    )
    expect(calls.some((call) => call.url.includes("/paper/import"))).toBe(false)
  })

  it("removes attached context and requires a job or job text again", async () => {
    installFetch("tool")
    render(<PaperLetterStart jobs={[]} onCreated={() => undefined} />)
    fireEvent.change(screen.getByLabelText("Attach letter context"), {
      target: { files: [new File(["Job"], "job.txt")] },
    })
    await screen.findByText("Context: job.txt")
    expect(screen.getByRole("button", { name: "Draft letter" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "Remove attachment" }))
    expect(screen.queryByText("Context: job.txt")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Draft letter" })).toBeDisabled()
  })

  it("preserves typed job context when an attachment cannot be read", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(fail(400, "FILE_UNSUPPORTED", "No readable text found."))
    )
    render(<PaperLetterStart jobs={[job]} onCreated={() => undefined} />)
    const query = screen.getByRole("textbox")
    fireEvent.change(query, { target: { value: "Product manager in retail" } })
    fireEvent.change(screen.getByLabelText("Attach letter context"), {
      target: { files: [new File([""], "blank.txt")] },
    })
    await screen.findByText("No readable text found.")
    expect(query).toHaveValue("Product manager in retail")
    expect(screen.getByRole("button", { name: "Draft letter" })).toBeEnabled()
    expect(screen.queryByText(/Context:/)).not.toBeInTheDocument()
  })

  it("does not claim a CV source in the saved letter editor", () => {
    installFetch("tool")
    render(
      <PaperLetterEditor doc={letter} job={job} onBack={() => undefined} />
    )
    expect(screen.queryByText(/^From/)).not.toBeInTheDocument()
    expect(screen.getByText("I write clearly.")).toBeInTheDocument()
  })

  it("prints the letter from Download PDF", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(ok({})))
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      expect(document.body).toHaveAttribute("data-print", "paper")
      const sheet = document.querySelector("[data-paper-letter]")
      expect(sheet?.textContent).toContain("I write clearly.")
      window.dispatchEvent(new Event("afterprint"))
    })
    render(
      <PaperLetterEditor
        doc={letter}
        job={job}

        onBack={() => undefined}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(print).toHaveBeenCalledTimes(1)
  })

  it("prints once in strict mode and unmounts the letter sheet", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(ok({})))
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined)
    render(
      <StrictMode>
        <PaperLetterEditor
          doc={letter}
          job={job}

          onBack={() => undefined}
        />
      </StrictMode>
    )
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(print).toHaveBeenCalledTimes(1)
    expect(document.querySelector("[data-paper-letter]")).not.toBeNull()
    act(() => {
      window.dispatchEvent(new Event("afterprint"))
    })
    expect(document.querySelector("[data-paper-letter]")).toBeNull()
  })

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

type Recorded = { url: string; body: unknown; keepalive?: boolean }

function installEditorFetch() {
  const calls: Recorded[] = []
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null
    calls.push({ url, body, keepalive: init?.keepalive })
    const version = contentVersionOf(body)
    if (url.includes("/api/commands/paper.replace")) {
      return Promise.resolve(ok({ ...letter, contentVersion: version + 1 }))
    }
    return Promise.resolve(ok({}))
  })
  return calls
}

function installConflictFetch(server: PaperView) {
  const calls: Recorded[] = []
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null
    calls.push({ url, body, keepalive: init?.keepalive })
    if (url.includes("/api/commands/paper.replace")) {
      const version = contentVersionOf(body)
      if (version < server.contentVersion) {
        return Promise.resolve(
          fail(
            409,
            "CONFLICT",
            "This document changed. Reload it and try again."
          )
        )
      }
      return Promise.resolve(ok({ ...server, contentVersion: version + 1 }))
    }
    if (url.includes(`/api/paper/${letter.id}`)) {
      return Promise.resolve(ok(server))
    }
    return Promise.resolve(ok({}))
  })
  return calls
}

function contentVersionOf(body: unknown) {
  if (!body || typeof body !== "object" || !("input" in body)) return 1
  const input = (body as { input?: { contentVersion?: number } }).input
  return input?.contentVersion ?? 1
}

function savedMarkdown(calls: Recorded[]) {
  const save = calls.find((call) => call.url.includes("paper.replace"))
  const input = (
    save?.body as { input?: { document?: { markdown?: string } } } | undefined
  )?.input
  return { save, markdown: input?.document?.markdown }
}

function caretOffset(node: HTMLElement) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return -1
  if (!node.contains(selection.anchorNode)) return -1
  const range = selection.getRangeAt(0)
  const before = range.cloneRange()
  before.selectNodeContents(node)
  before.setEnd(range.endContainer, range.endOffset)
  return before.toString().length
}

function placeCaret(node: HTMLElement, offset: number) {
  const text = node.firstChild
  if (!text) throw new Error("letter has no text")
  const range = document.createRange()
  range.setStart(text, offset)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function renderLetter() {
  return render(
    <PaperLetterEditor
      doc={letter}
      job={job}

      onBack={() => undefined}
    />
  )
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe("Letter edits survive autosave and leaving", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("restores the caret when a focused letter is filled", () => {
    installEditorFetch()
    const view = renderLetter()
    const box = screen.getByRole("textbox", { name: "Letter text" })
    box.focus()
    const written = "I write clearly. Ready."
    view.rerender(
      <PaperLetterEditor
        doc={{
          ...letter,
          contentVersion: 2,
          document: { markdown: written },
        }}
        job={job}

        onBack={() => undefined}
      />
    )
    expect(box.textContent).toBe(written)
    expect(caretOffset(box)).toBe(written.length)
  })

  it("reloads the server letter after a conflict", async () => {
    const server: PaperView = {
      ...letter,
      contentVersion: 4,
      document: { markdown: "Server copy from the api." },
    }
    const calls = installConflictFetch(server)
    renderLetter()
    const box = screen.getByRole("textbox", { name: "Letter text" })
    box.focus()
    box.textContent = "I write clearly. Z"
    fireEvent.input(box)
    await advance(700)

    fireEvent.click(screen.getByRole("button", { name: "Reload" }))
    await advance(0)

    expect(box.textContent).toBe("Server copy from the api.")
    box.textContent = "Server copy from the api. Q"
    fireEvent.input(box)
    await advance(700)

    const saves = calls.filter((call) => call.url.includes("paper.replace"))
    const last = saves[saves.length - 1]
    expect(contentVersionOf(last?.body)).toBe(4)
    expect(
      (last?.body as { input?: { document?: { markdown?: string } } }).input
        ?.document?.markdown
    ).toBe("Server copy from the api. Q")
  })

  it("adopts a later copy after the typed save settles", async () => {
    const calls = installEditorFetch()
    const view = renderLetter()
    const box = screen.getByRole("textbox", { name: "Letter text" })
    box.focus()
    box.textContent = "I write clearly. typed"
    fireEvent.input(box)
    await advance(700)

    expect(box.textContent).toBe("I write clearly. typed")
    const coach = "Coach rewrote the letter."
    view.rerender(
      <PaperLetterEditor
        doc={{
          ...letter,
          contentVersion: 4,
          document: { markdown: coach },
        }}
        job={job}

        onBack={() => undefined}
      />
    )
    expect(box.textContent).toBe(coach)

    box.textContent = "Coach rewrote the letter. Q"
    fireEvent.input(box)
    await advance(700)
    const saves = calls.filter((call) => call.url.includes("paper.replace"))
    expect(contentVersionOf(saves[saves.length - 1]?.body)).toBe(4)
  })

  it("puts the caret at the end of a server copy", async () => {
    installEditorFetch()
    const view = renderLetter()
    const box = screen.getByRole("textbox", { name: "Letter text" })
    box.focus()
    placeCaret(box, 1)
    fireEvent.input(box)
    await advance(700)

    const written = "Server copy from the api."
    box.focus()
    view.rerender(
      <PaperLetterEditor
        doc={{
          ...letter,
          contentVersion: 4,
          document: { markdown: written },
        }}
        job={job}

        onBack={() => undefined}
      />
    )
    expect(box.textContent).toBe(written)
    expect(caretOffset(box)).toBe(written.length)
  })

  it("saves a word with keepalive when the page hides", async () => {
    const calls = installEditorFetch()
    renderLetter()
    const box = screen.getByRole("textbox", { name: "Letter text" })
    box.focus()
    box.textContent = "harbor"
    fireEvent.input(box)

    await advance(200)
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"))
    })
    await advance(0)

    const saved = savedMarkdown(calls)
    expect(saved.markdown).toBe("harbor")
    expect(saved.save?.keepalive).toBe(true)
  })

  it("shows a later copy of the letter when the person has not typed", () => {
    installEditorFetch()
    const view = renderLetter()
    const box = screen.getByRole("textbox", { name: "Letter text" })
    const next: PaperView = {
      ...letter,
      contentVersion: 4,
      document: { markdown: "I write clearly. harbor" },
    }
    view.rerender(
      <PaperLetterEditor
        doc={next}
        job={job}

        onBack={() => undefined}
      />
    )
    expect(box.textContent).toBe("I write clearly. harbor")
  })

  it("keeps typed text when a stale copy of the letter arrives", () => {
    installEditorFetch()
    const view = renderLetter()
    const box = screen.getByRole("textbox", { name: "Letter text" })
    box.focus()
    box.textContent = "harbor"
    fireEvent.input(box)
    const next: PaperView = {
      ...letter,
      contentVersion: 4,
      document: { markdown: "I write clearly." },
    }
    view.rerender(
      <PaperLetterEditor
        doc={next}
        job={job}

        onBack={() => undefined}
      />
    )
    expect(box.textContent).toBe("harbor")
  })
})
