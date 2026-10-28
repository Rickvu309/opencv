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

describe("CV editor version 2", () => {
  it("keeps a pending block edit when dismissing an import check", async () => {
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
    const replacements: {
      contentVersion: number
      document: CvBlockDocument
    }[] = []
    const imported: PaperView = {
      ...record,
      document,
      sourceFileId: "source-file",
      checks: [
        {
          id: "phone-check",
          kind: "phone",
          message: "Phone missing",
          resolved: false,
        },
      ],
    }
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/paper/files")) {
        return Promise.resolve(ok([{ id: "source-file", name: "CV.pdf" }]))
      }
      if (String(input).includes("/api/commands/paper.dismissCheck")) {
        return Promise.resolve(ok({ ...imported, checks: [] }))
      }
      if (String(input).includes("/api/commands/paper.replace")) {
        const replacement = inputOf<
          { contentVersion: number; document: CvBlockDocument } & {
            docId: string
          }
        >(init)
        replacements.push(replacement)
        return Promise.resolve(
          ok({ ...record, contentVersion: 2, document: replacement.document })
        )
      }
      return Promise.resolve(ok({}))
    })
    render(
      <PaperCvEditor
        initial={imported}
        pages={pages(1)}
        onBack={() => undefined}
      />
    )
    expect(screen.getByText("Debate club")).toBeInTheDocument()
    expect(screen.getByText("Dean list")).toBeInTheDocument()
    const summary = screen.getByDisplayValue("Ships interview notes.")
    const skip = await screen.findByRole("button", { name: "Skip" })
    vi.useFakeTimers()
    fireEvent.change(summary, {
      target: { value: "Ships interview notes. Updated" },
    })
    await act(async () => {
      fireEvent.click(skip)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(replacements).toEqual([
      expect.objectContaining({
        contentVersion: 1,
        document: expect.objectContaining({
          version: 2,
          sections: expect.arrayContaining([
            expect.objectContaining({
              kind: "summary",
              blocks: expect.arrayContaining([
                {
                  id: "sum-1",
                  type: "text",
                  text: "Ships interview notes. Updated",
                },
              ]),
            }),
          ]),
        }),
      }),
    ])
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
        summary?: string
        experience?: { role?: string }[]
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
    render(
      <PaperCvEditor
        initial={record}
        pages={pages(2)}
        onBack={() => undefined}
      />
    )
    const summary = screen.getByRole("textbox", { name: "Summary" })
    vi.useFakeTimers()
    summary.textContent = "Queued before fit"
    fireEvent.input(summary)
    fireEvent.click(screen.getByRole("button", { name: "Fit to one page" }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByRole("textbox", { name: "Role" }).textContent).toBe(
      "Coach role"
    )
    expect(replaces).toEqual([])

    summary.textContent = "Coach summary X"
    fireEvent.input(summary)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(replaces).toEqual([
      expect.objectContaining({
        contentVersion: 5,
        document: expect.objectContaining({
          summary: "Coach summary X",
          experience: [expect.objectContaining({ role: "Coach role" })],
        }),
      }),
    ])
  })
})
