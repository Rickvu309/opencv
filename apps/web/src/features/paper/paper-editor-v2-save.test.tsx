import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { render as renderWithClient } from "@/test/render-with-client.tsx"
import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"
import {
  emptyCvDocument,
  type CvBlockDocument,
  type PaperPages,
  type PaperView,
} from "@workspace/domain"

import { PaperCvEditor } from "./paper-editor.tsx"

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
})

describe("CV editor version 2 save", () => {
  it("keeps version 2, the typed summary, and activities and awards", async () => {
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
    const bodies: {
      document?: {
        version?: number
        sections?: { id: string; kind: string; blocks: { text?: string }[] }[]
      }
    }[] = []
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
        initial={{ ...record, document }}
        pages={pages(1)}
        onBack={() => undefined}
      />
    )
    expect(screen.getByText("Debate club")).toBeInTheDocument()
    expect(screen.getByText("Dean list")).toBeInTheDocument()
    const summary = screen.getByRole("textbox", { name: "Summary" })
    vi.useFakeTimers()
    summary.textContent = "Ships interview notes.X"
    fireEvent.input(summary)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    const saved = bodies[0]?.document
    expect(saved?.version).toBe(2)
    expect(JSON.stringify(saved)).toContain("Ships interview notes.X")
    expect(
      saved?.sections?.find((section) => section.id === "sec-act")?.blocks[0]
        ?.text
    ).toBe("Debate club")
    expect(
      saved?.sections?.find((section) => section.id === "sec-aw")?.blocks[0]
        ?.text
    ).toBe("Dean list")
  })
})
