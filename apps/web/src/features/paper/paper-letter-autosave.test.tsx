import type { JobView, PaperView } from "@workspace/domain"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { render } from "@/test/render-with-client.tsx"
import letterDesign from "./design/letter-editor.snapshot.json"
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

function paragraph() {
  return screen.getByRole("textbox", {
    name: "Paragraph 1",
  }) as HTMLTextAreaElement
}

function type(box: HTMLElement, value: string) {
  fireEvent.change(box, { target: { value } })
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

  it("shows the source suggestion controls and keeps the saved letter editable", () => {
    installEditorFetch()
    renderLetter()
    const texts = letterDesign.sections.find(
      (section) => section.name === "Main wrap"
    )!.texts
    expect(screen.getByText(texts[17])).toBeVisible()
    expect(screen.getByRole("button", { name: texts[19] })).toBeEnabled()
    expect(screen.getByRole("button", { name: texts[20] })).toBeEnabled()
    expect(paragraph().tagName).toBe("TEXTAREA")
    fireEvent.click(screen.getByRole("button", { name: texts[20] }))
    expect(screen.queryByLabelText("Letter suggestion")).not.toBeInTheDocument()
    expect(paragraph().value).toBe("I write clearly.")
  })

  it("queues a keyword behind typing already being saved without losing either edit", async () => {
    const calls: Recorded[] = []
    let releaseTyping: (() => void) | undefined
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null
      if (!url.includes("/api/commands/paper.replace")) {
        return Promise.resolve(ok({}))
      }
      calls.push({ url, body })
      const saved = {
        ...letter,
        contentVersion: contentVersionOf(body) + 1,
      }
      if (calls.length === 1) {
        return new Promise<Response>((resolve) => {
          releaseTyping = () => resolve(ok(saved))
        })
      }
      return Promise.resolve(ok(saved))
    })
    renderLetter()
    const box = paragraph()
    type(box, "I write clearly. My newest sentence.")
    await advance(700)
    expect(calls).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: "Add to letter" }))
    expect(box.value).toBe("I write clearly. My newest sentence.\nMeta")
    expect(calls).toHaveLength(1)
    expect(screen.queryByRole("button", { name: "Add to letter" })).toBeNull()

    await act(async () => releaseTyping?.())
    await advance(0)
    expect(calls).toHaveLength(2)
    expect(contentVersionOf(calls[1]?.body)).toBe(2)
    expect(savedMarkdown(calls.slice(1)).markdown).toBe(
      "I write clearly. My newest sentence.\nMeta"
    )
    expect(screen.queryByRole("button", { name: "Reload" })).toBeNull()
  })

  it("fills an untouched letter with a later copy", () => {
    installEditorFetch()
    const view = renderLetter()
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
    expect(paragraph().value).toBe(written)
  })

  it("reloads the server letter after a conflict", async () => {
    const server: PaperView = {
      ...letter,
      contentVersion: 4,
      document: { markdown: "Server copy from the api." },
    }
    const calls = installConflictFetch(server)
    renderLetter()
    const box = paragraph()
    box.focus()
    type(box, "I write clearly. Z")
    await advance(700)

    fireEvent.click(screen.getByRole("button", { name: "Reload" }))
    await advance(0)

    expect(box.value).toBe("Server copy from the api.")
    type(box, "Server copy from the api. Q")
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
    const box = paragraph()
    box.focus()
    type(box, "I write clearly. typed")
    await advance(700)

    expect(box.value).toBe("I write clearly. typed")
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
    expect(box.value).toBe(coach)

    type(box, "Coach rewrote the letter. Q")
    await advance(700)
    const saves = calls.filter((call) => call.url.includes("paper.replace"))
    expect(contentVersionOf(saves[saves.length - 1]?.body)).toBe(4)
  })

  it("saves a word with keepalive when the page hides", async () => {
    const calls = installEditorFetch()
    renderLetter()
    const box = paragraph()
    box.focus()
    type(box, "harbor")

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
    const box = paragraph()
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
    expect(box.value).toBe("I write clearly. harbor")
  })

  it("keeps typed text when a stale copy of the letter arrives", () => {
    installEditorFetch()
    const view = renderLetter()
    const box = paragraph()
    box.focus()
    type(box, "harbor")
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
    expect(box.value).toBe("harbor")
  })

  it("keeps the parts the Coach wrote when the person types and the letter saves", async () => {
    const calls = installEditorFetch()
    const withParts = {
      markdown: "I write clearly.",
      sender: "Linh Nguyen",
      date: "October 26, 2026",
      closing: "Warm regards,",
      signature: "Linh",
    }
    render(
      <PaperLetterEditor
        doc={{ ...letter, document: withParts }}
        job={job}
        onBack={() => undefined}
      />
    )
    expect(
      (
        screen.getByRole("textbox", {
          name: "Sender name",
        }) as HTMLTextAreaElement
      ).value
    ).toBe("Linh Nguyen")
    type(paragraph(), "I write clearly and fast.")
    await advance(700)
    const save = calls.find((call) => call.url.includes("paper.replace"))
    expect(
      (save?.body as { input?: { document?: unknown } }).input?.document
    ).toEqual({ ...withParts, markdown: "I write clearly and fast." })
  })

  it("saves an edited part and leaves a blank part out", async () => {
    const calls = installEditorFetch()
    renderLetter()
    type(screen.getByRole("textbox", { name: "Date" }), "May 5")
    type(screen.getByRole("textbox", { name: "Sender name" }), "   ")
    await advance(700)
    const saves = calls.filter((call) => call.url.includes("paper.replace"))
    expect(
      (saves[saves.length - 1]?.body as { input?: { document?: unknown } })
        .input?.document
    ).toEqual({ markdown: "I write clearly.", date: "May 5" })
  })

  it("adds a missing keyword without dropping the parts", async () => {
    const calls = installEditorFetch()
    render(
      <PaperLetterEditor
        doc={{
          ...letter,
          document: { markdown: "I write clearly.", signature: "Linh" },
        }}
        job={job}
        onBack={() => undefined}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Add to letter" }))
    await advance(0)
    const save = calls.find((call) => call.url.includes("paper.replace"))
    expect(
      (save?.body as { input?: { document?: unknown } }).input?.document
    ).toEqual({ markdown: "I write clearly.\nMeta", signature: "Linh" })
  })
})
