import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, screen } from "@testing-library/react"

import type { WordPage } from "@workspace/domain"

import { render } from "@/test/render-with-client.tsx"

import { draftFromPage, pageBlocks } from "./canvas-edit.ts"
import { WritingCanvas } from "./canvas.tsx"

const DOC = "11111111-1111-7111-8111-111111111111"
const REVISION = "22222222-2222-4222-8222-222222222222"
const handles = {
  name: "a0000000-0000-4000-8000-000000000001",
  section: "a0000000-0000-4000-8000-000000000002",
  lead: "a0000000-0000-4000-8000-000000000003",
  sub: "a0000000-0000-4000-8000-000000000004",
  first: "a0000000-0000-4000-8000-000000000005",
  second: "a0000000-0000-4000-8000-000000000006",
  styled: "a0000000-0000-4000-8000-000000000007",
  link: "a0000000-0000-4000-8000-000000000008",
  table: "a0000000-0000-4000-8000-000000000009",
}

function line(
  handle: string,
  pieces: { text: string; marks?: ("bold" | "italic" | "underline")[] }[],
  extra: Partial<WordPage["paragraphs"][number]> = {}
) {
  return {
    handle,
    text: pieces.map((piece) => piece.text).join(""),
    pieces: pieces.map((piece) => ({ ...piece, editable: true })),
    held: false,
    message: "",
    code: null,
    ...extra,
  }
}

function cv(): WordPage {
  return {
    doc: DOC,
    revision: REVISION,
    name: "CV.docx",
    label: "cv",
    paragraphs: [
      line(handles.name, [{ text: "Linh Nguyen" }], {
        form: { kind: "title" },
        align: "center",
      }),
      line(handles.section, [{ text: "Experience" }], {
        form: { kind: "heading", level: 1 },
      }),
      line(
        handles.lead,
        [{ text: "Growth: ", marks: ["bold"] }, { text: "grew followers" }],
        { form: { kind: "bullet", level: 0 } }
      ),
      line(
        handles.sub,
        [{ text: "weekly ", marks: ["italic"] }, { text: "scripts" }],
        { form: { kind: "bullet", level: 1 } }
      ),
      line(handles.first, [{ text: "First", marks: ["underline"] }], {
        form: { kind: "number", level: 0 },
      }),
      line(handles.second, [{ text: "Second" }], {
        form: { kind: "number", level: 0 },
        align: "justify",
      }),
      line(handles.styled, [{ text: "Both", marks: ["bold", "italic"] }]),
      {
        handle: handles.link,
        text: "Portfolio at ",
        pieces: [
          { text: "Portfolio at ", editable: true },
          { text: "example site", editable: false, marks: ["link"] },
        ],
        held: false,
        message: "",
        code: null,
      },
      {
        handle: handles.table,
        text: "Cell words",
        pieces: [{ text: "Cell words", editable: false }],
        held: true,
        message:
          "This line sits in a table or a box. Paper will not change it.",
        code: "NOT_BODY",
      },
    ],
  }
}

function page() {
  const article = screen.getByRole("article", { name: "Page" })
  if (!(article instanceof HTMLElement)) throw new Error("missing page")
  return article
}

function block(id: string) {
  const found = page().querySelector<HTMLElement>(`p[data-block="${id}"]`)
  if (!found) throw new Error(`missing ${id}`)
  return found
}

function words() {
  return [...page().querySelectorAll(":scope > p")].map((item) =>
    (item.textContent ?? "").replaceAll("\u200b", "")
  )
}

function caretIn(node: Node, offset: number) {
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  const selection = document.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

async function typeText(value: string) {
  await act(async () => {
    page().dispatchEvent(
      new InputEvent("beforeinput", {
        inputType: "insertText",
        data: value,
        bubbles: true,
        cancelable: true,
      })
    )
  })
}

function textOf(element: Element | null) {
  const text = element?.firstChild
  if (!text || text.nodeType !== Node.TEXT_NODE) throw new Error("no text")
  return text
}

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
  localStorage.clear()
})

describe("an imported CV on the writing page", () => {
  it("draws headings, marks, lists, alignment and links", () => {
    render(<WritingCanvas docId={DOC} seed={draftFromPage(cv())} />)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Linh Nguyen"
    )
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Experience"
    )
    expect(block(handles.name).dataset.align).toBe("center")
    expect(block(handles.lead).querySelector("strong")?.textContent).toBe(
      "Growth: "
    )
    expect(block(handles.sub).querySelector("em")?.textContent).toBe("weekly ")
    expect(block(handles.first).querySelector("u")?.textContent).toBe("First")
    expect(block(handles.styled).querySelector("strong em")?.textContent).toBe(
      "Both"
    )
    expect(
      [handles.lead, handles.sub, handles.first, handles.second].map(
        (id) => block(id).dataset.marker
      )
    ).toEqual(["•", "◦", "1.", "2."])
    expect(block(handles.sub).style.paddingInlineStart).toBe("3em")
    expect(block(handles.second).dataset.align).toBe("justify")
    const link = block(`${handles.link}#1`)
    expect(link.contentEditable).toBe("false")
    expect(link.querySelector(".writing-link")?.textContent).toBe(
      "example site"
    )
    expect(link.querySelector("a")).toBeNull()
    expect(block(handles.table).contentEditable).toBe("false")
    expect(
      screen.getByText(
        "This line sits in a table or a box. Paper will not change it."
      )
    ).toBeVisible()
  })

  it("keeps the words the page reads exactly as a plain page", () => {
    render(<WritingCanvas docId={DOC} seed={draftFromPage(cv())} />)
    expect(words()).toEqual(pageBlocks(cv()).map((item) => item.text))
    expect(localStorage.getItem(`opencv-writing:${DOC}`)).not.toContain(
      '"look"'
    )
  })

  it("keeps typing inside a bold word bold and after a bullet's last word plain", async () => {
    render(<WritingCanvas docId={DOC} seed={draftFromPage(cv())} />)
    caretIn(textOf(block(handles.lead).querySelector("strong")), 3)
    await typeText("X")
    expect(block(handles.lead).querySelector("strong")?.textContent).toBe(
      "GroXwth: "
    )
    expect(block(handles.lead).textContent).toBe("GroXwth: grew followers")
    expect(document.getSelection()?.focusOffset).toBe(4)
    const lead = block(handles.lead)
    const tail = lead.lastChild
    if (!tail) throw new Error("no tail")
    caretIn(tail, tail.textContent?.length ?? 0)
    await typeText("!")
    expect(block(handles.lead).textContent).toBe("GroXwth: grew followers!")
    expect(block(handles.lead).querySelector("strong")?.textContent).toBe(
      "GroXwth: "
    )
    expect(block(handles.lead).dataset.marker).toBe("•")
  })

  it("leaves a blank page as plain as before", () => {
    render(<WritingCanvas docId={DOC} />)
    const only = page().querySelector(":scope > p")
    expect(only?.childNodes.length).toBe(1)
    expect(only?.firstChild?.nodeType).toBe(Node.TEXT_NODE)
    expect(
      only?.getAttributeNames().filter((name) => name !== "contenteditable")
    ).toEqual(["data-block"])
  })

  it("shows a soft line break between two editable sides of one line", () => {
    const handle = "a0000000-0000-4000-8000-000000000010"
    const page = cv()
    render(
      <WritingCanvas
        docId={DOC}
        seed={draftFromPage({
          ...page,
          paragraphs: [
            {
              handle,
              text: "Marketing InternJun 2025 to now",
              pieces: [
                { text: "Marketing Intern", editable: true, marks: ["bold"] },
                { text: "\n", editable: false },
                { text: "Jun 2025 to now", editable: true },
              ],
              held: false,
              message: "",
              code: null,
            },
          ],
        })}
      />
    )
    const first = block(`${handle}#0`)
    const gap = block(`${handle}#1`)
    const second = block(`${handle}#2`)
    expect(page.paragraphs.length).toBeGreaterThan(1)
    expect(first.contentEditable).toBe("true")
    expect(first.querySelector("strong")?.textContent).toBe("Marketing Intern")
    expect(gap.contentEditable).toBe("false")
    expect(gap.hasAttribute("data-break")).toBe(true)
    expect(second.contentEditable).toBe("true")
    expect(second.textContent).toBe("Jun 2025 to now")
    expect(first.hasAttribute("data-break")).toBe(false)
  })
})
