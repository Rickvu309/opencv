import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"

import type { WordPage } from "@workspace/domain"

import { render } from "@/test/render-with-client.tsx"

import { draftFromPage } from "./canvas-edit.ts"
import { KEPT_PART_LINE, NUMBERED_LINE } from "./canvas-fixed-lines.ts"
import {
  BROWSER_INPUT_TYPES,
  DRAG_NOT_SAVED,
  FORMAT_NOT_SAVED,
  inputRule,
  PASTE_TOO_LONG,
} from "./canvas-input.ts"
import { PASTE_LINE_LIMIT } from "./canvas-state.ts"
import { WritingCanvas } from "./canvas.tsx"

const DOC = "11111111-1111-7111-8111-111111111111"
const REVISION = "22222222-2222-4222-8222-222222222222"
const H = {
  title: "a0000000-0000-4000-8000-000000000001",
  heading: "a0000000-0000-4000-8000-000000000002",
  bullet: "a0000000-0000-4000-8000-000000000003",
  link: "a0000000-0000-4000-8000-000000000004",
  plain: "a0000000-0000-4000-8000-000000000005",
  after: "a0000000-0000-4000-8000-000000000006",
}

function line(
  handle: string,
  text: string,
  extra: Partial<WordPage["paragraphs"][number]> = {}
) {
  return {
    handle,
    text,
    pieces: [{ text, editable: true }],
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
      line(H.title, "Linh Nguyen", { form: { kind: "title" } }),
      line(H.heading, "Experience", { form: { kind: "heading", level: 1 } }),
      line(H.bullet, "Bachelor of Business, RMIT", {
        form: { kind: "bullet", level: 0 },
      }),
      {
        handle: H.link,
        text: "Portfolio at ",
        pieces: [
          { text: "Portfolio at ", editable: true },
          { text: "linh.example", editable: false, marks: ["link"] },
        ],
        held: false,
        message: "",
        code: null,
      },
      line(H.plain, "Ho Chi Minh City"),
      line(H.after, "Available from June"),
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
    (item.textContent ?? "").replaceAll("​", "")
  )
}

function saved(): string[] {
  const raw = JSON.parse(localStorage.getItem(`opencv-writing:${DOC}`) ?? "{}")
  const draft = raw.draft ?? raw
  return draft.blocks.map((item: { text: string }) => item.text)
}

function marks() {
  return [...page().querySelectorAll("b, i, u, s, sub, sup, font, span[style]")]
    .length
}

function status() {
  return screen.getByRole("status").textContent ?? ""
}

function textIn(id: string) {
  const found = block(id)
  const walker = document.createTreeWalker(found, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  return nodes
}

function pointAt(id: string, offset: number): [Node, number] {
  let left = offset
  const nodes = textIn(id)
  for (const node of nodes) {
    if (left <= node.data.length) return [node, left]
    left -= node.data.length
  }
  const last = nodes.at(-1)
  if (!last) return [block(id), 0]
  return [last, last.data.length]
}

function select(from: [string, number], to: [string, number] = from) {
  const [startNode, startOffset] = pointAt(from[0], from[1])
  const [endNode, endOffset] = pointAt(to[0], to[1])
  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  const selection = document.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function lengthOf(id: string) {
  return (block(id).textContent ?? "").replaceAll("​", "").length
}

function beforeInput(
  inputType: string,
  extra: {
    data?: string
    text?: string
    target?: [[string, number], [string, number]]
  } = {}
) {
  const event = new InputEvent("beforeinput", {
    inputType,
    data: extra.data ?? null,
    bubbles: true,
    cancelable: true,
  })
  if (extra.text !== undefined) {
    const text = extra.text
    Object.defineProperty(event, "dataTransfer", {
      value: { getData: (kind: string) => (kind === "text/plain" ? text : "") },
    })
  }
  if (extra.target) {
    const [from, to] = extra.target
    const [startContainer, startOffset] = pointAt(from[0], from[1])
    const [endContainer, endOffset] = pointAt(to[0], to[1])
    Object.defineProperty(event, "getTargetRanges", {
      value: () => [{ startContainer, startOffset, endContainer, endOffset }],
    })
  }
  return event
}

async function send(event: Event) {
  await act(async () => {
    page().dispatchEvent(event)
  })
  return event
}

async function press(key: string, mods: Record<string, boolean> = {}) {
  let event: KeyboardEvent | null = null
  await act(async () => {
    event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...mods,
    })
    page().dispatchEvent(event)
  })
  return event as unknown as KeyboardEvent
}

async function paste(plain: string, html = "") {
  const event = new Event("paste", { bubbles: true, cancelable: true })
  Object.defineProperty(event, "clipboardData", {
    value: {
      getData: (kind: string) =>
        kind === "text/plain" ? plain : kind === "text/html" ? html : "",
    },
  })
  await send(event)
}

function open() {
  render(
    <WritingCanvas
      docId={DOC}
      seed={draftFromPage(cv())}
      seedRevision={REVISION}
    />
  )
}

const LINK_TEXT = `${H.link}#0`

const PLACES: {
  name: string
  from: [string, number]
  to?: [string, number]
}[] = [
  { name: "the start of a plain line", from: [H.plain, 0] },
  { name: "the middle of a plain line", from: [H.plain, 6] },
  { name: "the end of a plain line", from: [H.plain, 16] },
  { name: "the start of a heading", from: [H.heading, 0] },
  { name: "the middle of a heading", from: [H.heading, 5] },
  { name: "the end of a heading", from: [H.heading, 10] },
  { name: "the start of a bullet", from: [H.bullet, 0] },
  { name: "the middle of a bullet", from: [H.bullet, 9] },
  { name: "the end of a bullet", from: [H.bullet, 26] },
  { name: "the start of the words before a link", from: [LINK_TEXT, 0] },
  { name: "the middle of the words before a link", from: [LINK_TEXT, 5] },
  { name: "the edge of a link", from: [LINK_TEXT, 13] },
  { name: "a selection inside one line", from: [H.plain, 3], to: [H.plain, 9] },
  {
    name: "a selection across two lines",
    from: [H.plain, 3],
    to: [H.after, 4],
  },
  {
    name: "a selection across a bullet and a heading",
    from: [H.heading, 4],
    to: [H.bullet, 4],
  },
]

const EDITING_TYPES = BROWSER_INPUT_TYPES.filter(
  (type) => inputRule(type).kind !== "native"
)

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
  localStorage.clear()
})

describe("every way a person can change the writing page", () => {
  it.each(PLACES)(
    "at $name, every input type is handled so the page shows what is saved, or blocked so nothing changes",
    async (place) => {
      open()
      const startMarks = marks()
      for (const type of EDITING_TYPES) {
        const clamp = (point: [string, number]): [string, number] => [
          point[0],
          Math.min(point[1], lengthOf(point[0])),
        ]
        const ids = new Set(
          saved().length
            ? [...page().querySelectorAll<HTMLElement>(":scope > p")].map(
                (item) => item.dataset.block
              )
            : []
        )
        const from = ids.has(place.from[0]) ? clamp(place.from) : null
        if (!from) break
        const to = place.to && ids.has(place.to[0]) ? clamp(place.to) : from
        select(from, to)
        const before = words()
        const event = await send(
          beforeInput(type, { data: "x", text: "y", target: [from, to] })
        )
        expect(event.defaultPrevented, type).toBe(true)
        expect(words(), type).toEqual(saved())
        expect(marks(), type).toBe(startMarks)
        if (inputRule(type).kind === "blocked")
          expect(words(), type).toEqual(before)
      }
    }
  )
})

describe("formatting from the keyboard", () => {
  it("shows no bold, italic or underline and says once that it is not saved", async () => {
    open()
    select([H.plain, 3], [H.plain, 6])
    await send(beforeInput("formatBold"))
    await send(beforeInput("formatItalic"))
    await send(beforeInput("formatUnderline"))
    expect(marks()).toBe(0)
    expect(words()).toEqual(saved())
    expect(status()).toBe(FORMAT_NOT_SAVED)
    expect(
      page().ownerDocument.querySelectorAll(".writing-notice")
    ).toHaveLength(1)
  })

  it("goes back to the save line on the next letter typed", async () => {
    open()
    select([H.plain, 16])
    await send(beforeInput("formatBold"))
    expect(status()).toBe(FORMAT_NOT_SAVED)
    await send(beforeInput("insertText", { data: "!" }))
    expect(words()).toContain("Ho Chi Minh City!")
    expect(status()).not.toBe(FORMAT_NOT_SAVED)
    expect(status()).toBe(
      "Writing is not saved yet. A copy stays on this computer."
    )
  })
})

describe("word and line deletes", () => {
  it("deletes the word before the caret at the end of a bullet and saves it", async () => {
    open()
    select([H.bullet, 26])
    await send(beforeInput("deleteWordBackward"))
    expect(block(H.bullet).textContent).toBe("Bachelor of Business, ")
    expect(words()).toEqual(saved())
  })

  it("deletes exactly the range the browser names for a word delete", async () => {
    open()
    select([H.plain, 16])
    await send(
      beforeInput("deleteWordBackward", {
        target: [
          [H.plain, 7],
          [H.plain, 16],
        ],
      })
    )
    expect(block(H.plain).textContent).toBe("Ho Chi ")
    expect(words()).toEqual(saved())
  })

  it("deletes the next word at the start of a line", async () => {
    open()
    select([H.after, 0])
    await send(beforeInput("deleteWordForward"))
    expect(block(H.after).textContent).toBe(" from June")
    expect(words()).toEqual(saved())
  })

  it("deletes to the start and to the end of a line", async () => {
    open()
    select([H.after, 10])
    await send(beforeInput("deleteSoftLineBackward"))
    expect(block(H.after).textContent).toBe("from June")
    await send(beforeInput("deleteHardLineForward"))
    expect(block(H.after).textContent?.replaceAll("\u200b", "")).toBe("")
    expect(words()).toEqual(saved())
  })

  it("refuses a word delete at the start of a line after a bullet, which would join it", async () => {
    open()
    select([H.bullet, 0])
    await send(beforeInput("deleteWordBackward"))
    expect(words()).toEqual(saved())
    select([H.heading, 10])
    await send(beforeInput("deleteContentForward"))
    expect(block(H.bullet).textContent).toBe("Bachelor of Business, RMIT")
    expect(status()).toBe(NUMBERED_LINE)
  })
})

describe("cut", () => {
  it("cuts words inside one line and saves the rest", async () => {
    open()
    select([H.plain, 0], [H.plain, 3])
    await send(beforeInput("deleteByCut"))
    expect(block(H.plain).textContent).toBe("Chi Minh City")
    expect(words()).toEqual(saved())
  })

  it("cuts across two plain lines and joins them", async () => {
    open()
    select([H.plain, 3], [H.after, 10])
    await send(beforeInput("deleteByCut"))
    expect(block(H.plain).textContent).toBe("Ho from June")
    expect(words()).toEqual(saved())
  })

  it("refuses a cut that would join a bullet and changes nothing", async () => {
    open()
    const before = words()
    select([H.heading, 4], [H.bullet, 4])
    await send(beforeInput("deleteByCut"))
    expect(words()).toEqual(before)
    expect(status()).toBe(NUMBERED_LINE)
  })

  it("does nothing for a cut with no selection", async () => {
    open()
    const before = words()
    select([H.plain, 4])
    await send(beforeInput("deleteByCut"))
    expect(words()).toEqual(before)
  })
})

describe("Enter, Shift+Enter and Tab", () => {
  it("starts a new line after a heading and saves it", async () => {
    open()
    select([H.heading, 10])
    expect((await press("Enter")).defaultPrevented).toBe(true)
    await send(beforeInput("insertText", { data: "Lead" }))
    expect(words().slice(1, 3)).toEqual(["Experience", "Lead"])
    expect(words()).toEqual(saved())
  })

  it("makes Shift+Enter a new line, the same as Enter", async () => {
    open()
    select([H.plain, 3])
    await press("Enter", { shiftKey: true })
    expect(words()).toContain("Ho ")
    expect(words()).toContain("Chi Minh City")
    expect(words()).toEqual(saved())
  })

  it.each([
    ["Enter", {}],
    ["Enter", { shiftKey: true }],
  ])(
    "refuses %s on a bullet at its start, middle and end",
    async (key, mods) => {
      open()
      const before = words()
      for (const offset of [0, 9, 26]) {
        select([H.bullet, offset])
        await press(key, mods)
        expect(words()).toEqual(before)
      }
      expect(status()).toBe(NUMBERED_LINE)
    }
  )

  it("refuses a new line in the words next to a link", async () => {
    open()
    const before = words()
    select([LINK_TEXT, 13])
    await press("Enter")
    expect(words()).toEqual(before)
    expect(status()).toBe(KEPT_PART_LINE)
    await send(beforeInput("insertLineBreak"))
    expect(words()).toEqual(before)
  })

  it("lets Tab and Shift+Tab leave the page", async () => {
    open()
    select([H.plain, 3])
    expect((await press("Tab")).defaultPrevented).toBe(false)
    expect((await press("Tab", { shiftKey: true })).defaultPrevented).toBe(
      false
    )
    expect(words()).toEqual(saved())
  })
})

describe("paste and drop", () => {
  it("pastes rich text from a web page or Word as plain words", async () => {
    open()
    select([H.heading, 10])
    await paste("Rich words", "<b>Rich</b> <i style='color:red'>words</i>")
    expect(block(H.heading).textContent).toBe("ExperienceRich words")
    expect(marks()).toBe(0)
    expect(words()).toEqual(saved())
  })

  it("puts each pasted paragraph on its own line in a plain line", async () => {
    open()
    select([H.plain, 16])
    await paste("One\nTwo\r\nThree")
    const at = words().indexOf("Ho Chi Minh CityOne")
    expect(words().slice(at, at + 3)).toEqual([
      "Ho Chi Minh CityOne",
      "Two",
      "Three",
    ])
    expect(words()).toEqual(saved())
  })

  it("refuses several pasted paragraphs in a bullet, and keeps one", async () => {
    open()
    const before = words()
    select([H.bullet, 26])
    await paste("One\nTwo")
    expect(words()).toEqual(before)
    expect(status()).toBe(NUMBERED_LINE)
    await paste(" and more")
    expect(block(H.bullet).textContent).toBe(
      "Bachelor of Business, RMIT and more"
    )
    expect(words()).toEqual(saved())
  })

  it("refuses a paste longer than one save can hold and takes one at the limit", async () => {
    open()
    const before = words()
    select([H.plain, 16])
    await paste(
      Array.from({ length: PASTE_LINE_LIMIT + 1 }, (_, i) => `L${i}`).join("\n")
    )
    expect(words()).toEqual(before)
    expect(status()).toBe(PASTE_TOO_LONG)
    await paste("x".repeat(9000))
    expect(words()).toEqual(before)
    await paste(
      Array.from({ length: PASTE_LINE_LIMIT }, (_, i) => `L${i}`).join("\n")
    )
    expect(words()).toHaveLength(before.length + PASTE_LINE_LIMIT - 1)
    expect(words()).toEqual(saved())
  })

  it("refuses dropped and dragged words with a notice", async () => {
    open()
    const before = words()
    select([H.plain, 3])
    await send(beforeInput("insertFromDrop", { text: "dropped" }))
    select([H.plain, 0], [H.plain, 3])
    await send(beforeInput("deleteByDrag"))
    expect(words()).toEqual(before)
    expect(status()).toBe(DRAG_NOT_SAVED)
  })
})

describe("Undo and Redo of the person's typing", () => {
  it.each([
    ["Ctrl+Shift+Z", { ctrlKey: true, shiftKey: true }, "z"],
    ["Cmd+Shift+Z", { metaKey: true, shiftKey: true }, "z"],
    ["Ctrl+Y", { ctrlKey: true }, "y"],
  ])(
    "undoes with Ctrl or Cmd+Z and redoes with %s, and saves each",
    async (_name, mods, key) => {
      open()
      select([H.plain, 16])
      await send(beforeInput("insertText", { data: "A" }))
      await send(beforeInput("insertText", { data: "B" }))
      await press(
        "z",
        "metaKey" in mods ? { metaKey: true } : { ctrlKey: true }
      )
      expect(block(H.plain).textContent).toBe("Ho Chi Minh CityA")
      expect(words()).toEqual(saved())
      await press(key, mods)
      expect(block(H.plain).textContent).toBe("Ho Chi Minh CityAB")
      expect(words()).toEqual(saved())
    }
  )

  it("undoes and redoes from the browser's Edit menu", async () => {
    open()
    select([H.plain, 16])
    await send(beforeInput("insertText", { data: "A" }))
    await send(beforeInput("historyUndo"))
    expect(block(H.plain).textContent).toBe("Ho Chi Minh City")
    await send(beforeInput("historyRedo"))
    expect(block(H.plain).textContent).toBe("Ho Chi Minh CityA")
    expect(words()).toEqual(saved())
  })

  it("forgets what could be redone once the person types again", async () => {
    open()
    select([H.plain, 16])
    await send(beforeInput("insertText", { data: "A" }))
    await press("z", { ctrlKey: true })
    select([H.plain, 16])
    await send(beforeInput("insertText", { data: "C" }))
    await press("y", { ctrlKey: true })
    expect(block(H.plain).textContent).toBe("Ho Chi Minh CityC")
  })

  it("has nothing to redo on a freshly opened page", async () => {
    open()
    const before = words()
    await press("z", { ctrlKey: true, shiftKey: true })
    expect(words()).toEqual(before)
  })
})

describe("spelling fixes and composed words", () => {
  it("saves a spelling replacement over the range the browser names", async () => {
    open()
    select([H.after, 0])
    await send(
      beforeInput("insertReplacementText", {
        text: "Open",
        target: [
          [H.after, 0],
          [H.after, 9],
        ],
      })
    )
    expect(block(H.after).textContent).toBe("Open from June")
    expect(words()).toEqual(saved())
  })

  it("keeps a Vietnamese word composed in a bullet", async () => {
    open()
    select([H.bullet, 26])
    fireEvent.compositionStart(page())
    const composing = beforeInput("insertCompositionText", { data: "Việt" })
    page().dispatchEvent(composing)
    expect(composing.defaultPrevented).toBe(false)
    await act(async () => {
      fireEvent.compositionEnd(page(), { data: "Việt" })
    })
    expect(block(H.bullet).textContent).toBe("Bachelor of Business, RMITViệt")
    expect(words()).toEqual(saved())
  })

  it("keeps a composed word and refuses the Enter that ended it on a bullet", async () => {
    open()
    select([H.bullet, 26])
    fireEvent.compositionStart(page())
    const enter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(enter, "keyCode", { get: () => 229 })
    page().dispatchEvent(enter)
    await act(async () => {
      fireEvent.compositionEnd(page(), { data: "Việt" })
    })
    expect(block(H.bullet).textContent).toBe("Bachelor of Business, RMITViệt")
    expect(words()).toHaveLength(7)
    expect(status()).toBe(NUMBERED_LINE)
  })
})
