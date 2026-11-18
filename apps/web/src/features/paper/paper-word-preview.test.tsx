import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { act, cleanup, screen, waitFor } from "@testing-library/react"

import { render } from "@/test/render-with-client.tsx"
import { cv } from "./paper-library.fixtures.tsx"
import { LibraryEntryCard } from "./paper-library-sections.tsx"
import { PaperWordPreview } from "./paper-word-preview.tsx"

const read = vi.fn<typeof fetch>()
const ids = {
  ada: "11111111-1111-4111-8111-111111111111",
  blank: "22222222-2222-4222-8222-222222222222",
  offline: "33333333-3333-4333-8333-333333333333",
}

function page(text: string) {
  return {
    doc: "11111111-1111-4111-8111-111111111111",
    revision: "22222222-2222-4222-8222-222222222222",
    name: "Ada.docx",
    label: "cv",
    paragraphs: [
      {
        handle: "44444444-4444-4444-8444-444444444444",
        text,
        pieces: text ? [{ text, editable: true, marks: ["bold"] }] : [],
        held: false,
        code: null,
        message: "",
        ...(text ? { form: { kind: "title" } } : {}),
      },
    ],
  }
}

beforeEach(() => vi.stubGlobal("fetch", read))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  read.mockReset()
})

it("draws the saved Word first page with its formatting and no editing surface", async () => {
  read.mockResolvedValue(Response.json({ ok: true, data: page("Ada Nguyen") }))
  const { container } = render(
    <LibraryEntryCard
      entry={{
        type: "paper",
        doc: { ...cv("Ada.docx"), format: "word" },
      }}
      on={{ onOpen: vi.fn(), onPreview: vi.fn() }}
    />
  )
  await waitFor(() =>
    expect(
      container.querySelector("[data-form=title] strong")
    ).toHaveTextContent("Ada Nguyen")
  )
  expect(container.querySelector("[contenteditable]")).toBeNull()
  const face = screen
    .getByText("Ada Nguyen")
    .closest<HTMLElement>(".writing-page")
  expect(face?.style.backgroundColor).toBe("transparent")
  expect(face?.style.color).toBe("inherit")
  expect(
    container.querySelector("[data-slot=paper-word-first-page]")
  ).toHaveAttribute("inert")
})

it("shares a cached page read across cards", async () => {
  read.mockResolvedValue(Response.json({ ok: true, data: page("Ada Nguyen") }))
  render(
    <>
      <PaperWordPreview docId={ids.ada} />
      <PaperWordPreview docId={ids.ada} />
    </>
  )
  await waitFor(() => expect(screen.getAllByText("Ada Nguyen")).toHaveLength(2))
  expect(read).toHaveBeenCalledTimes(1)
})

it("loads near the viewport and keeps a quiet skeleton until the page arrives", async () => {
  let reveal: () => void = () => undefined
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        reveal = () => callback([{ isIntersecting: true }])
      }
      observe() {}
      disconnect() {}
    }
  )
  read.mockResolvedValue(Response.json({ ok: true, data: page("Ada Nguyen") }))
  const { container } = render(<PaperWordPreview docId={ids.ada} />)
  expect(
    container.querySelector("[data-slot=paper-preview-loading]")
  ).toBeInTheDocument()
  expect(read).not.toHaveBeenCalled()
  act(() => reveal())
  await waitFor(() => expect(container).toHaveTextContent("Ada Nguyen"))
})

it("keeps a saved blank paragraph blank and identifies an unavailable preview", async () => {
  read.mockResolvedValueOnce(Response.json({ ok: true, data: page("") }))
  const { container, unmount } = render(<PaperWordPreview docId={ids.blank} />)
  await waitFor(() => expect(container.querySelector("p")).toBeInTheDocument())
  expect(container.querySelector("p")?.textContent).toBe("\u200b")
  unmount()
  read.mockRejectedValueOnce(new Error("offline"))
  render(<PaperWordPreview docId={ids.offline} />)
  expect(await screen.findByText("Preview unavailable")).toBeInTheDocument()
})
