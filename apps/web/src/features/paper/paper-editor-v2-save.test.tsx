import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { render as renderWithClient } from "@/test/render-with-client.tsx"
import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"
import {
  blankBlockDocument,
  emptyCvDocument,
  type CvBlockDocument,
  type PaperPages,
  type PaperView,
} from "@workspace/domain"

import { PaperCvEditor } from "./paper-editor.tsx"
import * as paperPrint from "./paper-print.ts"

function render(ui: ReactElement) {
  const wrap = (content: ReactElement) => (
    <ChatStoreProvider>{content}</ChatStoreProvider>
  )
  const view = renderWithClient(wrap(ui))
  return {
    ...view,
    rerender: (next: ReactElement) => view.rerender(wrap(next)),
  }
}

const record: PaperView = {
  id: "doc-1",
  name: "PM track CV",
  kind: "cv",
  templateId: "simple",
  status: "draft",
  document: emptyCvDocument(),
  contentVersion: 1,
  checks: [],
  pageChoice: "unset",
  isFavorite: false,
  sourceFileId: null,
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
}

function pages(count: number): PaperPages {
  return { docId: record.id, pages: count, pageChoice: "unset" }
}

function inputOf<T>(init?: RequestInit) {
  return (JSON.parse(String(init?.body)) as { input: T }).input
}

function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("CV editor version 2", () => {
  it("saves a block edit on a version 2 CV", async () => {
    const document: CvBlockDocument = {
      version: 2,
      header: {
        name: "Ada Verify",
        email: "",
        phone: "",
        city: "",
        linkedin: "",
      },
      sections: [
        {
          id: "sec-summary",
          kind: "summary",
          blocks: [
            { id: "sum-1", type: "text", text: "Ships interview notes." },
          ],
        },
        {
          id: "sec-act",
          kind: "activities",
          blocks: [{ id: "act-1", type: "text", text: "Debate club" }],
        },
        {
          id: "sec-aw",
          kind: "awards",
          blocks: [{ id: "aw-1", type: "text", text: "Dean list" }],
        },
      ],
    }
    const calls: string[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      calls.push(String(input))
      return Promise.resolve(ok({}))
    })
    render(
      <PaperCvEditor
        initial={{ ...record, document }}
        pages={pages(1)}
        onBack={() => undefined}
      />
    )
    expect(
      screen.queryByText("This CV uses blocks. The block editor is coming.")
    ).not.toBeInTheDocument()
    expect(screen.getByText("Debate club")).toBeInTheDocument()
    expect(screen.getByText("Dean list")).toBeInTheDocument()
    const summary = screen.getByRole("textbox", { name: "Summary" })
    vi.useFakeTimers()
    summary.textContent = "Ships interview notes.X"
    fireEvent.input(summary)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(
      calls.some((url) => url.includes("/api/commands/paper.replace"))
    ).toBe(true)
  })

  it("stores version 2 after one keystroke on a version 1 CV", async () => {
    const bodies: { document?: { version?: number } }[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/commands/paper.replace")) {
        bodies.push(inputOf(init))
        return Promise.resolve(ok({ ...record, contentVersion: 2 }))
      }
      return Promise.resolve(ok({}))
    })
    render(
      <PaperCvEditor
        initial={record}
        pages={pages(1)}
        onBack={() => undefined}
      />
    )
    const role = screen.getByRole("textbox", { name: "Role" })
    vi.useFakeTimers()
    role.textContent = "PM"
    fireEvent.input(role)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(bodies[0]?.document?.version).toBe(2)
  })

  it("keeps typing queued while an older block save is in flight", async () => {
    const replacements: {
      contentVersion: number
      document: CvBlockDocument
    }[] = []
    let release: (response: Response) => void = () => undefined
    const pending = new Promise<Response>((resolve) => {
      release = resolve
    })
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/commands/paper.replace")) {
        replacements.push(inputOf(init))
        if (replacements.length === 1) return pending
        return Promise.resolve(ok({ ...record, contentVersion: 3 }))
      }
      return Promise.resolve(ok({}))
    })
    render(
      <PaperCvEditor
        initial={{ ...record, document: blankBlockDocument() }}
        pages={pages(1)}
        onBack={() => undefined}
      />
    )
    const name = screen
      .getAllByRole("textbox", { name: "Name" })
      .find((node) => node.getAttribute("data-placeholder") === "Name")
    if (!name) throw new Error("header name field missing")
    vi.useFakeTimers()
    name.textContent = "First edit"
    fireEvent.input(name)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    name.textContent = "Second edit"
    fireEvent.input(name)
    await act(async () => {
      release(ok({ ...record, contentVersion: 2 }))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(replacements).toHaveLength(2)
    expect(replacements[1]).toMatchObject({
      contentVersion: 2,
      document: { header: { name: "Second edit" } },
    })
  })

  it("saves the keystroke after Fit at the Coach version with the Coach fields", async () => {
    const coach = {
      ...emptyCvDocument(),
      name: "Ada Verify",
      summary: "Coach summary",
      experience: [
        {
          role: "Coach role",
          company: "UIT",
          period: "2024",
          bullets: ["Ran interviews"],
        },
      ],
    }
    const replaces: {
      contentVersion?: number
      document?: {
        version?: number
        sections?: {
          kind?: string
          blocks?: { type?: string; text?: string; role?: string }[]
        }[]
      }
    }[] = []
    const turn =
      'event: tool-result\ndata: {"toolCallId":"t","name":"paper.replace","summary":"Saved","ok":true,"result":{"ok":true,"data":{}}}\n\n'
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/commands/chat.create")) {
        return Promise.resolve(ok({ id: "chat-1" }))
      }
      if (url.includes("/api/chats/chat-1/turns")) {
        return Promise.resolve(new Response(turn, { status: 200 }))
      }
      if (url.includes(`/api/paper/${record.id}`)) {
        return Promise.resolve(
          ok({ ...record, contentVersion: 5, document: coach })
        )
      }
      if (url.includes("/api/commands/paper.replace")) {
        replaces.push(inputOf(init))
        return Promise.resolve(
          ok({ ...record, contentVersion: 6, document: coach })
        )
      }
      return Promise.resolve(ok({}))
    })
    vi.spyOn(paperPrint, "readPreviewPageCount").mockReturnValue(2)
    render(
      <PaperCvEditor
        initial={record}
        pages={pages(2)}
        onBack={() => undefined}
      />
    )
    const role = screen.getByRole("textbox", { name: "Role" })
    vi.useFakeTimers()
    role.textContent = "Queued before fit"
    fireEvent.input(role)
    fireEvent.click(screen.getByRole("button", { name: "Fit to one page" }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByRole("textbox", { name: "Role" }).textContent).toBe(
      "Coach role"
    )
    expect(replaces).toEqual([])

    const summary = screen.getByRole("textbox", { name: "Summary" })
    summary.textContent = "Coach summary X"
    fireEvent.input(summary)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    const saved = replaces[0]?.document
    const summaryText = saved?.sections
      ?.find((section) => section.kind === "summary")
      ?.blocks?.find((block) => block.type === "text")?.text
    const savedRole = saved?.sections
      ?.find((section) => section.kind === "experience")
      ?.blocks?.find((block) => block.type === "experience-entry")?.role
    expect(replaces[0]?.contentVersion).toBe(5)
    expect(saved?.version).toBe(2)
    expect(summaryText).toBe("Coach summary X")
    expect(savedRole).toBe("Coach role")
  })
})
