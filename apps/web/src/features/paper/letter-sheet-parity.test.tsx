import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render } from "@testing-library/react"

import { LetterSheet } from "./letter-sheet.tsx"
import snapshot from "./design/letter-sheet.snapshot.json"
import styles from "./design/letter-sheet.styles.json"

const css = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "design/letter-sheet.pen.css"
  ),
  "utf8"
)

afterEach(cleanup)

const sections = snapshot.sections.filter((section) => section.texts.length > 0)
const penText = (name: string) => sections.find((s) => s.name === name)!.texts
const bodyTexts = sections
  .filter((section) => section.name.startsWith("Paragraph "))
  .map((section) => section.texts[0]!)
const styleOf = (content: string) =>
  styles.sections.flatMap((s) => s.texts).find((t) => t.content === content)!

const letter = {
  sender: "Linh Nguyen",
  contact: sections[1]!.texts[0]!,
  date: "October 26, 2026",
  recipient: ["Hiring Team", "Lumière Cosmetics", "Ho Chi Minh City"].join(
    "\n"
  ),
  salutation: "Dear Lumière hiring team,",
  markdown: bodyTexts.join("\n\n"),
  closing: "Warm regards,",
  signature: "Linh Nguyen",
}

function rule(role: string) {
  const selector = `[data-slot="letter-${role}"]`
  const block = css.split("}").find((chunk) => chunk.includes(`> ${selector}`))
  if (!block) throw new Error(`no rule for ${role}`)
  return block
}

describe("letter sheet matches the pen sheet", () => {
  it("shows the pen's text for every role, in the pen's order", () => {
    const { container } = render(<LetterSheet letter={letter} />)
    const shown = [...container.querySelectorAll("[data-slot^='letter-']")]
      .filter((node) => node.getAttribute("data-slot") !== "letter-sheet")
      .map((node) => node.textContent)
    expect(shown).toEqual([
      penText("Linh Nguyen")[0],
      letter.contact,
      "October 26, 2026",
      letter.recipient,
      "Dear Lumière hiring team,",
      ...bodyTexts,
      "Warm regards,",
      "Linh Nguyen",
    ])
  })

  it.each([
    ["sender", "Linh Nguyen", 15, 700, "#111111"],
    ["contact", letter.contact, 10, 400, "#8A8A8E"],
    ["date", "October 26, 2026", 10.5, 400, "#3C3C40"],
    ["recipient", "Hiring Team", 10.5, 400, "#3C3C40"],
    ["salutation", "Dear Lumière hiring team,", 11, 400, "#111111"],
    ["paragraph", bodyTexts[0]!, 11, 400, "#2F2F31"],
    ["closing", "Warm regards,", 11, 400, "#2F2F31"],
  ] as const)(
    "styles %s with the pen's size, weight and colour",
    (role, content, size, weight, fill) => {
      const pen = styleOf(content.split("\n")[0]!)
      expect(pen.fontSize).toBe(size)
      expect(pen.fill).toBe(fill)
      const block = rule(role)
      expect(block).toContain(`font-size: ${size}px`)
      expect(block).toContain(`font-weight: ${weight}`)
      const darkenedContactInk = "color-mix(in srgb, #8a8a8e 80%, #111111)"
      const want = role === "contact" ? darkenedContactInk : fill.toLowerCase()
      expect(block.toLowerCase()).toContain(`color: ${want}`)
      if (pen.lineHeight)
        expect(block).toContain(`line-height: ${pen.lineHeight}`)
    }
  )

  it("sizes the sheet like the pen page", () => {
    expect(css).toContain("width: 560px")
    expect(css).toContain("min-height: 792px")
    expect(css).toContain("padding: 56px 60px")
  })
})
