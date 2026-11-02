import type { LetterDocument } from "@workspace/domain"
import { useReducer } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { LetterSheet } from "./letter-sheet.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const full: LetterDocument = {
  markdown: "First paragraph.\n\nSecond paragraph.",
  sender: "Linh Nguyen",
  contact: "linh@example.com",
  date: "October 26, 2026",
  recipient: "Hiring Team\nLumiere\nHo Chi Minh City",
  salutation: "Dear team,",
  closing: "Warm regards,",
  signature: "Linh",
}

function Harness({
  initial,
  seen,
}: {
  initial: LetterDocument
  seen: LetterDocument[]
}) {
  const [letter, setLetter] = useReducer(
    (_current: LetterDocument, next: LetterDocument) => next,
    initial
  )
  return (
    <LetterSheet
      letter={letter}
      mode="edit"
      onChange={(next) => {
        seen.push(next)
        setLetter(next)
      }}
    />
  )
}

function lastBody(seen: LetterDocument[]) {
  return seen[seen.length - 1]!.markdown
}

function field(name: string) {
  return screen.getByRole("textbox", { name }) as HTMLTextAreaElement
}

describe("LetterSheet read mode", () => {
  it("shows each filled part and each body paragraph in order", () => {
    const { container } = render(<LetterSheet letter={full} mode="read" />)
    const slots = [...container.querySelectorAll("[data-slot^='letter-']")]
      .filter((node) => node.getAttribute("data-slot") !== "letter-sheet")
      .map((node) => [node.getAttribute("data-slot"), node.textContent])
    expect(slots).toEqual([
      ["letter-sender", "Linh Nguyen"],
      ["letter-contact", "linh@example.com"],
      ["letter-date", "October 26, 2026"],
      ["letter-recipient", "Hiring Team\nLumiere\nHo Chi Minh City"],
      ["letter-salutation", "Dear team,"],
      ["letter-paragraph", "First paragraph."],
      ["letter-paragraph", "Second paragraph."],
      ["letter-closing", "Warm regards,"],
      ["letter-signature", "Linh"],
    ])
  })

  it("renders an old body-only letter as paragraphs alone, with no fields or placeholders", () => {
    const { container } = render(
      <LetterSheet letter={{ markdown: "One.\n\nTwo." }} mode="read" />
    )
    expect(container.querySelectorAll("textarea")).toHaveLength(0)
    expect(
      container.querySelectorAll("[data-slot='letter-paragraph']")
    ).toHaveLength(2)
    expect(container.querySelector("[data-slot='letter-sender']")).toBeNull()
    expect(container.querySelector("[placeholder]")).toBeNull()
  })

  it("leaves out blank parts and an empty body", () => {
    const { container } = render(
      <LetterSheet
        letter={{ markdown: "  ", sender: "  ", date: "" }}
        mode="read"
      />
    )
    expect(container.querySelectorAll("[data-slot^='letter-']")).toHaveLength(1)
  })

  it("keeps the body text equal to the stored string", () => {
    const body = "A line\nbreak.\n\nNext one."
    const { container } = render(
      <LetterSheet letter={{ markdown: body }} mode="read" />
    )
    const text = [
      ...container.querySelectorAll("[data-slot='letter-paragraph']"),
    ]
      .map((node) => node.textContent)
      .join("\n\n")
    expect(text).toBe(body)
  })
})

describe("LetterSheet edit mode", () => {
  it("shows a labelled field and a placeholder for every empty part", () => {
    render(<LetterSheet letter={{ markdown: "" }} mode="edit" />)
    for (const label of [
      "Sender name",
      "Contact details",
      "Date",
      "Recipient",
      "Salutation",
      "Paragraph 1",
      "Closing",
      "Signature",
    ]) {
      expect(field(label).placeholder).not.toBe("")
    }
    expect(field("Sender name").value).toBe("")
  })

  it("reports a part edit without touching the body", async () => {
    const seen: LetterDocument[] = []
    render(<Harness initial={{ markdown: "Body." }} seen={seen} />)
    await userEvent.type(field("Sender name"), "Li")
    expect(seen.at(-1)).toEqual({ markdown: "Body.", sender: "Li" })
  })

  it("keeps a single-line part on one line", async () => {
    const seen: LetterDocument[] = []
    render(<Harness initial={{ markdown: "" }} seen={seen} />)
    await userEvent.type(field("Date"), "May{Enter}5")
    expect(seen.at(-1)?.date).toBe("May5")
    fireEvent.change(field("Date"), { target: { value: "May\n5" } })
    expect(seen.at(-1)?.date).toBe("May 5")
  })

  it("lets the recipient hold several lines", () => {
    const seen: LetterDocument[] = []
    render(<Harness initial={{ markdown: "" }} seen={seen} />)
    fireEvent.change(field("Recipient"), { target: { value: "A\nB" } })
    expect(seen.at(-1)?.recipient).toBe("A\nB")
  })

  it("splits a paragraph at the caret on Enter and moves the caret", async () => {
    const seen: LetterDocument[] = []
    render(<Harness initial={{ markdown: "HelloWorld" }} seen={seen} />)
    const first = field("Paragraph 1")
    first.focus()
    first.setSelectionRange(5, 5)
    await userEvent.keyboard("{Enter}")
    expect(lastBody(seen)).toBe("Hello\n\nWorld")
    const second = field("Paragraph 2")
    expect(second.value).toBe("World")
    expect(document.activeElement).toBe(second)
    expect(second.selectionStart).toBe(0)
  })

  it("replaces a selection when Enter splits", async () => {
    const seen: LetterDocument[] = []
    render(<Harness initial={{ markdown: "abcdef" }} seen={seen} />)
    const first = field("Paragraph 1")
    first.focus()
    first.setSelectionRange(2, 4)
    await userEvent.keyboard("{Enter}")
    expect(lastBody(seen)).toBe("ab\n\nef")
  })

  it("keeps Shift+Enter as a line break inside the paragraph", async () => {
    const seen: LetterDocument[] = []
    render(<Harness initial={{ markdown: "ab" }} seen={seen} />)
    field("Paragraph 1").focus()
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}")
    expect(screen.queryByRole("textbox", { name: "Paragraph 2" })).toBeNull()
  })

  it("merges with the paragraph before on Backspace at the start", async () => {
    const seen: LetterDocument[] = []
    render(<Harness initial={{ markdown: "ab\n\ncd" }} seen={seen} />)
    const second = field("Paragraph 2")
    second.focus()
    second.setSelectionRange(0, 0)
    await userEvent.keyboard("{Backspace}")
    expect(lastBody(seen)).toBe("abcd")
    const only = field("Paragraph 1")
    expect(document.activeElement).toBe(only)
    expect(only.selectionStart).toBe(2)
  })

  it("does not merge on Backspace with a selection or away from the start", async () => {
    const seen: LetterDocument[] = []
    render(<Harness initial={{ markdown: "ab\n\ncd" }} seen={seen} />)
    const second = field("Paragraph 2")
    second.focus()
    second.setSelectionRange(0, 1)
    await userEvent.keyboard("{Backspace}")
    expect(lastBody(seen)).toBe("ab\n\nd")
    expect(field("Paragraph 2").value).toBe("d")
  })

  it("merges with the next paragraph on Delete at the end", async () => {
    const seen: LetterDocument[] = []
    render(<Harness initial={{ markdown: "ab\n\ncd" }} seen={seen} />)
    const first = field("Paragraph 1")
    first.focus()
    first.setSelectionRange(2, 2)
    await userEvent.keyboard("{Delete}")
    expect(lastBody(seen)).toBe("abcd")
    expect(field("Paragraph 1").selectionStart).toBe(2)
  })

  it("does nothing special for Backspace in the first paragraph", async () => {
    const seen: LetterDocument[] = []
    render(<Harness initial={{ markdown: "ab" }} seen={seen} />)
    const first = field("Paragraph 1")
    first.focus()
    first.setSelectionRange(0, 0)
    await userEvent.keyboard("{Backspace}")
    expect(seen).toHaveLength(0)
  })

  it("ignores Enter, Backspace and Delete while an IME is composing", () => {
    const seen: LetterDocument[] = []
    render(<Harness initial={{ markdown: "ab\n\ncd" }} seen={seen} />)
    const first = field("Paragraph 1")
    first.setSelectionRange(1, 1)
    fireEvent.keyDown(first, { key: "Enter", isComposing: true })
    fireEvent.keyDown(first, { key: "Enter", keyCode: 229 })
    const second = field("Paragraph 2")
    second.setSelectionRange(0, 0)
    fireEvent.keyDown(second, { key: "Backspace", isComposing: true })
    first.setSelectionRange(2, 2)
    fireEvent.keyDown(first, { key: "Delete", keyCode: 229 })
    expect(seen).toHaveLength(0)
    expect(field("Paragraph 1").value).toBe("ab")
  })

  it("lets composed text through as an ordinary change", () => {
    const seen: LetterDocument[] = []
    render(<Harness initial={{ markdown: "" }} seen={seen} />)
    const first = field("Paragraph 1")
    fireEvent.compositionStart(first)
    fireEvent.change(first, { target: { value: "にほ" } })
    fireEvent.compositionEnd(first)
    expect(lastBody(seen)).toBe("にほ")
  })

  it("splits a pasted blank line into paragraphs and moves the caret to the end", () => {
    const seen: LetterDocument[] = []
    render(<Harness initial={{ markdown: "xy" }} seen={seen} />)
    const first = field("Paragraph 1")
    first.focus()
    fireEvent.change(first, {
      target: {
        value: "xone\n\ntwo\n\nthreey",
        selectionStart: 15,
        selectionEnd: 15,
      },
    })
    expect(lastBody(seen)).toBe("xone\n\ntwo\n\nthreey")
    expect(field("Paragraph 3").value).toBe("threey")
    expect(document.activeElement).toBe(field("Paragraph 3"))
  })

  it("keeps the caret in place for a plain keystroke", async () => {
    const seen: LetterDocument[] = []
    render(<Harness initial={{ markdown: "ac" }} seen={seen} />)
    const first = field("Paragraph 1")
    first.focus()
    first.setSelectionRange(1, 1)
    await userEvent.keyboard("b")
    expect(lastBody(seen)).toBe("abc")
    expect(field("Paragraph 1").selectionStart).toBe(2)
  })

  it("grows a field to its content where field-sizing is missing", () => {
    vi.stubGlobal("CSS", { supports: () => false })
    const heights = vi
      .spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get")
      .mockReturnValue(48)
    render(<LetterSheet letter={{ markdown: "tall" }} mode="edit" />)
    expect(field("Paragraph 1").style.height).toBe("48px")
    heights.mockRestore()
  })

  it("leaves the height to the browser where field-sizing works", () => {
    vi.stubGlobal("CSS", { supports: () => true })
    render(<LetterSheet letter={{ markdown: "tall" }} mode="edit" />)
    expect(field("Paragraph 1").style.height).toBe("")
  })
})
