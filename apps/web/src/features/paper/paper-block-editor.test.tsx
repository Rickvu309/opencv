import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { useState } from "react"
import type { CvBlockDocument, PaperView } from "@workspace/domain"
import { PaperBlockEditor } from "./paper-block-editor.tsx"

const initial: CvBlockDocument = {
  version: 2,
  header: { name: "Ada", email: "", phone: "", city: "", linkedin: "" },
  sections: [
    {
      id: "summary",
      kind: "summary",
      blocks: [
        { id: "one", type: "text", text: "First" },
        { id: "two", type: "text", text: "Second" },
      ],
    },
  ],
}

const checks: PaperView["checks"] = []

function Harness({
  value = initial,
  onChange = vi.fn(),
  onDismissCheck = vi.fn(),
  checks: currentChecks = checks,
}: {
  value?: CvBlockDocument
  onChange?: (document: CvBlockDocument) => void
  onDismissCheck?: (id: string) => void
  checks?: PaperView["checks"]
}) {
  const [document, setDocument] = useState(value)
  return (
    <PaperBlockEditor
      document={document}
      checks={currentChecks}
      sourceFileName={currentChecks.length ? "resume.pdf" : null}
      onChange={(next) => {
        onChange(next)
        setDocument(next)
      }}
      onAskCoach={() => undefined}
      onDismissCheck={onDismissCheck}
    />
  )
}

function blocksOf(document: CvBlockDocument) {
  return (
    document.sections.find((section) => section.kind === "summary")?.blocks ??
    []
  )
}

afterEach(cleanup)

describe("PaperBlockEditor", () => {
  it("edits header fields and inserts a block", () => {
    const onChange = vi.fn<(document: CvBlockDocument) => void>()
    render(<Harness onChange={onChange} />)
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Ada Lovelace" },
    })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        header: expect.objectContaining({ name: "Ada Lovelace" }),
      })
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Add block to Summary" })
    )
    fireEvent.click(
      within(screen.getByRole("group", { name: "Insert block" })).getByRole(
        "button",
        { name: /^Text/ }
      )
    )
    expect(blocksOf(onChange.mock.calls.at(-1)?.[0] ?? initial)).toHaveLength(3)
    expect(
      blocksOf(onChange.mock.calls.at(-1)?.[0] ?? initial)[2]
    ).toMatchObject({ type: "text", text: "" })
  })

  it("duplicates, moves, and deletes blocks while preserving unique ids", () => {
    const onChange = vi.fn<(document: CvBlockDocument) => void>()
    render(<Harness onChange={onChange} />)
    fireEvent.click(
      screen.getAllByRole("button", { name: "Actions for text block" })[1]!
    )
    fireEvent.click(screen.getByRole("menuitem", { name: "Move up" }))
    expect(
      blocksOf(onChange.mock.calls.at(-1)?.[0] ?? initial).map((block) =>
        block.type === "text" ? block.text : block.type
      )
    ).toEqual(["Second", "First"])
    fireEvent.click(
      screen.getAllByRole("button", { name: "Actions for text block" })[0]!
    )
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }))
    const duplicated = blocksOf(onChange.mock.calls.at(-1)?.[0] ?? initial)
    expect(
      duplicated.map((block) =>
        block.type === "text" ? block.text : block.type
      )
    ).toEqual(["Second", "Second", "First"])
    expect(new Set(duplicated.map((block) => block.id)).size).toBe(3)
    fireEvent.click(
      screen.getAllByRole("button", { name: "Actions for text block" })[2]!
    )
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }))
    expect(
      blocksOf(onChange.mock.calls.at(-1)?.[0] ?? initial).map((block) =>
        block.type === "text" ? block.text : block.type
      )
    ).toEqual(["Second", "Second"])
  })

  it("reorders blocks by dragging", () => {
    const onChange = vi.fn<(document: CvBlockDocument) => void>()
    render(<Harness onChange={onChange} />)
    const handles = screen.getAllByRole("button", { name: "Drag text block" })
    const target = document.querySelector('[data-block-id="one"]')
    fireEvent.dragStart(handles[1]!)
    fireEvent.dragOver(target!)
    fireEvent.drop(target!)
    expect(
      blocksOf(onChange.mock.calls.at(-1)?.[0] ?? initial).map((block) =>
        block.type === "text" ? block.text : block.type
      )
    ).toEqual(["Second", "First"])
  })

  it("focuses the phone field from the check and reports Skip", () => {
    const onDismissCheck = vi.fn()
    const check: PaperView["checks"][number] = {
      id: "phone-check",
      kind: "phone",
      message: "Phone missing",
      resolved: false,
    }
    render(<Harness checks={[check]} onDismissCheck={onDismissCheck} />)
    fireEvent.click(screen.getByRole("button", { name: "Add phone" }))
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Phone" })
    )
    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    expect(onDismissCheck).toHaveBeenCalledWith("phone-check")
  })

  it("allows deleting the last section and adding one back", () => {
    const onChange = vi.fn<(document: CvBlockDocument) => void>()
    const oneSection = {
      ...initial,
      sections: [{ id: "only", kind: "summary" as const, blocks: [] }],
    }
    render(<Harness value={oneSection} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Remove section" }))
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sections: [] })
    )
    fireEvent.click(screen.getByRole("button", { name: "Add section" }))
    fireEvent.click(
      within(screen.getByRole("group", { name: "Insert section" })).getByRole(
        "button",
        { name: "Summary" }
      )
    )
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sections: [expect.objectContaining({ kind: "summary", blocks: [] })],
      })
    )
  })

  it("opens slash insert from the section while keeping slash text in fields", () => {
    render(<Harness />)
    const section = screen.getByRole("region", { name: "Summary section" })
    section.focus()
    fireEvent.keyDown(section, { key: "/" })
    expect(
      screen.getByRole("group", { name: "Insert block" })
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: "Add block to Summary" })
    )
    const name = screen.getByRole("textbox", { name: "Name" })
    fireEvent.keyDown(name, { key: "/" })
    expect(
      screen.queryByRole("group", { name: "Insert block" })
    ).not.toBeInTheDocument()
    fireEvent.change(name, { target: { value: "Ada/" } })
    expect(name).toHaveValue("Ada/")
  })
})
