import { upgradeStoredPaper, type PaperView } from "@workspace/domain"
import { SERVER_ORIGIN, writeDocument } from "@workspace/paper-crdt"
import { act, cleanup, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { paragraph, seededLetterClient } from "@/test/paper-fixture.ts"
import { render } from "@/test/render-with-client.tsx"

import { PaperLetterEditor } from "./paper-letter.tsx"

const fixture = vi.hoisted(() => ({
  client: null as null | ReturnType<typeof seededLetterClient>,
}))

vi.mock("@/lib/paper-sync.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paper-sync.ts")>()),
  usePaperSync: () => ({
    sync: null,
    status: "saved" as const,
    generation: 1,
    client: fixture.client,
  }),
}))

const letterPaper = upgradeStoredPaper("letter", {
  markdown: "I write clearly.",
})
if (!letterPaper.ok) throw new Error(letterPaper.message)

const letter: PaperView = {
  id: "letter-1",
  name: "Cover letter, Northwind",
  kind: "letter",
  templateId: "simple",
  status: "draft",
  paper: letterPaper.document,
  contentVersion: 1,
  checks: [],
  pageChoice: "unset",
  isFavorite: false,
  sourceFileId: null,
  createdAt: "2026-08-25T12:00:00.000Z",
  updatedAt: "2026-08-25T12:00:00.000Z",
}

beforeAll(() => {
  Element.prototype.getClientRects ??= () => [] as unknown as DOMRectList
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})

afterEach(cleanup)

const edited = () =>
  document.querySelector('[data-slot="letter-editor-edited"]')!.textContent

function rewrite(origin: string, text: string) {
  const client = fixture.client!
  const doc = client.document()!
  act(() => {
    writeDocument(
      client.ydoc,
      {
        ...doc,
        blocks: [{ id: "p1", type: "paragraph", content: [{ text }] }],
      } as never,
      origin
    )
  })
}

describe("the Edited label", () => {
  it("changes on the person's own edit and not on a remote update", async () => {
    fixture.client = seededLetterClient([paragraph("p1", "Dear team")])
    render(
      <PaperLetterEditor doc={letter} job={null} onBack={() => undefined} />
    )
    expect(await screen.findByText("Dear team")).toBeInTheDocument()
    expect(edited()).not.toBe("Edited just now")
    rewrite(SERVER_ORIGIN, "Changed")
    expect(await screen.findByText("Changed")).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(edited()).not.toBe("Edited just now")
    rewrite("typing", "Typed")
    await waitFor(() => expect(edited()).toBe("Edited just now"))
  })
})
