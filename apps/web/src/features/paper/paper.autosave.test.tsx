import {
  parsePaperId,
  upgradeStoredPaper,
  type PaperPages,
  type PaperView,
} from "@workspace/domain"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { getMockPaperDocs, paperApiFetch } from "@/test/paper-api-mock.ts"

import { PaperCvEditor } from "./paper-editor.tsx"
import { render } from "./paper-editor.fixtures.tsx"

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})

function savedSummary() {
  const cv = getMockPaperDocs().find((doc) => doc.name === "PM track CV")
  const content = cv?.content as
    | {
        summary?: string
        sections?: {
          kind?: string
          blocks?: { type?: string; text?: string }[]
        }[]
      }
    | undefined
  const text = content?.sections
    ?.find((section) => section.kind === "summary")
    ?.blocks?.find((block) => block.type === "text")?.text
  return text ?? content?.summary
}

function pmTrack(): PaperView {
  const doc = getMockPaperDocs().find((item) => item.name === "PM track CV")
  if (!doc) throw new Error("missing PM track CV")
  const paper = upgradeStoredPaper("cv", doc.content)
  if (!paper.ok) throw new Error(paper.message)
  return {
    id: parsePaperId(doc.id),
    name: doc.name,
    kind: "cv",
    templateId: "simple",
    status: doc.status,
    document: doc.content,
    paper: paper.document,
    contentVersion: doc.contentVersion,
    checks: [],
    pageChoice: "unset",
    isFavorite: false,
    sourceFileId: null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function pagesOf(view: PaperView): PaperPages {
  return { docId: view.id, pages: 1, pageChoice: "unset" }
}

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const paper = await paperApiFetch(input, init)
      if (paper) return paper
      return Response.json({ ok: true, data: {} })
    }
  )
}

function typeSummary(summary: HTMLElement, text: string) {
  summary.textContent = text
  fireEvent.input(summary)
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function openCv() {
  stubFetch()
  const view = pmTrack()
  const mounted = render(
    <PaperCvEditor
      initial={view}
      pages={pagesOf(view)}
      onBack={() => undefined}
    />
  )
  return {
    summary: screen.getByRole("textbox", { name: "Summary" }),
    unmount: mounted.unmount,
  }
}

describe("Paper autosave timing", () => {
  it("saves 700 ms after the last edit and restarts the wait on each edit", async () => {
    const { summary } = openCv()
    const before = savedSummary()

    vi.useFakeTimers()
    typeSummary(summary, "first burst")
    await advance(400)
    typeSummary(summary, "first burst, second burst")
    await advance(400)
    expect(savedSummary()).toBe(before)

    await advance(299)
    expect(savedSummary()).toBe(before)
    await advance(1)
    expect(savedSummary()).toBe("first burst, second burst")
  })

  it("flushes a pending edit when the editor unmounts before the timer", async () => {
    const { summary, unmount } = openCv()

    vi.useFakeTimers()
    typeSummary(summary, "flush me")
    unmount()
    await advance(0)

    expect(savedSummary()).toBe("flush me")
  })
})
