import type { JobView, PaperView } from "@workspace/domain"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { render } from "@/test/render-with-client.tsx"
import { PaperLetterEditor } from "./paper-letter.tsx"

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

function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

function fail(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status })
}

afterEach(() => {
  document.body.removeAttribute("data-print")
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
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
