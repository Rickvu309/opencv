import type { LetterDocument } from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"

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

describe("LetterSheet read mode", () => {
  it("shows each filled part and each body paragraph in order", () => {
    const { container } = render(<LetterSheet letter={full} />)
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
      <LetterSheet letter={{ markdown: "One.\n\nTwo." }} />
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
      <LetterSheet letter={{ markdown: "  ", sender: "  ", date: "" }} />
    )
    expect(container.querySelectorAll("[data-slot^='letter-']")).toHaveLength(1)
  })

  it("keeps the body text equal to the stored string", () => {
    const body = "A line\nbreak.\n\nNext one."
    const { container } = render(<LetterSheet letter={{ markdown: body }} />)
    const text = [
      ...container.querySelectorAll("[data-slot='letter-paragraph']"),
    ]
      .map((node) => node.textContent)
      .join("\n\n")
    expect(text).toBe(body)
  })
})
