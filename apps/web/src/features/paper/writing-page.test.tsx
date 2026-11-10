import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { render } from "@/test/render-with-client.tsx"
import {
  attachWritingProposal,
  clearWritingProposal,
  publishWritingProposal,
  writingProposal,
} from "@/lib/writing-proposal.ts"
import { WritingPage } from "./writing-page.tsx"

const DOC = "11111111-1111-4111-8111-111111111111"
const PARAGRAPH = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const REVISION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const PENDING = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const ACTIVITY = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const TARGET = `t_${"ab".repeat(32)}`

function draft(text: string) {
  return {
    blocks: [{ id: PARAGRAPH, text }],
    caret: { blockId: PARAGRAPH, offset: 0 },
    nextId: 2,
  }
}

function readPage(text: string) {
  return {
    generation: "package",
    docId: DOC,
    revision: REVISION,
    name: "Page.docx",
    kind: "letter",
    packageHash: "ab".repeat(32),
    byteSize: 128,
    projector: "paper-package-spans-1",
    regions: [
      {
        kind: "editable",
        paragraph: PARAGRAPH,
        targetId: TARGET,
        text,
        location: { paragraph: 1, kind: "paragraph" },
        formatting: { kind: "inherited", scope: "preserved-uncomputed" },
        context: { paragraphText: text },
      },
    ],
    nextCursor: null,
  }
}

function words() {
  const article = screen.getByRole("article", { name: "Page" })
  return [...article.querySelectorAll(":scope > p")].map((block) =>
    (block.textContent ?? "").replaceAll("\u200b", "")
  )
}

afterEach(() => {
  clearWritingProposal()
  localStorage.clear()
  cleanup()
  vi.unstubAllGlobals()
})

it("ignores a Coach edit that is not one replacement", () => {
  publishWritingProposal("call-empty", {
    docId: DOC,
    edits: [],
  })
  publishWritingProposal("call-two", {
    docId: DOC,
    edits: [
      { op: "replaceText", before: "One", after: "Two" },
      { op: "replaceText", before: "Three", after: "Four" },
    ],
  })
  expect(writingProposal()).toBeNull()
})

it("approves a Coach replacement onto the page and undoes it", async () => {
  let serverText = "Before line"
  const calls: string[] = []
  vi.stubGlobal("fetch", async (url: RequestInfo | URL) => {
    const path = String(url)
    calls.push(path)
    if (path.includes("/api/commands/actions.approve")) {
      serverText = "After line"
      return Response.json({ ok: true, data: { id: ACTIVITY } })
    }
    if (path.includes("/api/commands/activity.undo")) {
      serverText = "Before line"
      return Response.json({ ok: true, data: { id: ACTIVITY } })
    }
    if (path.includes("/api/reads/paper.read")) {
      return Response.json({ ok: true, data: readPage(serverText) })
    }
    return Response.json({ ok: true, data: {} })
  })
  localStorage.setItem(
    `opencv-writing:${DOC}`,
    JSON.stringify(draft("Before line"))
  )
  publishWritingProposal("call-1", {
    docId: DOC,
    basedOn: REVISION,
    edits: [
      {
        op: "replaceText",
        targetId: TARGET,
        before: "Before line",
        after: "After line",
      },
    ],
  })
  attachWritingProposal("call-1", PENDING)
  render(<WritingPage docId={DOC} seed={draft("Before line")} />)
  const proposal = await screen.findByRole("region", {
    name: "Coach proposal",
  })
  expect(proposal).toHaveTextContent("Before")
  expect(proposal).toHaveTextContent("Before line")
  expect(proposal).toHaveTextContent("After")
  expect(proposal).toHaveTextContent("After line")
  await waitFor(() => expect(words()).toEqual(["Before line"]))
  fireEvent.click(screen.getByRole("button", { name: "Approve" }))
  await waitFor(() => expect(words()).toEqual(["After line"]))
  expect(screen.getByRole("button", { name: "Undo" })).toBeVisible()
  expect(
    calls.some((path) => path.includes("/api/commands/actions.approve"))
  ).toBe(true)
  expect(localStorage.getItem(`opencv-writing:${DOC}`)).toContain("After line")
  fireEvent.click(screen.getByRole("button", { name: "Undo" }))
  await waitFor(() => expect(words()).toEqual(["Before line"]))
  expect(screen.getByText("Undone")).toBeVisible()
  expect(
    calls.some((path) => path.includes("/api/commands/activity.undo"))
  ).toBe(true)
})
