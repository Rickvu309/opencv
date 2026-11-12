import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"

import type { WordPage } from "@workspace/domain"

import { render } from "@/test/render-with-client.tsx"

import { draftFromPage } from "./canvas-edit.ts"
import { KEPT_PART_LINE, NUMBERED_LINE } from "./canvas-fixed-lines.ts"
import { CHANGE_NOT_KEPT } from "./canvas-input.ts"
import { WritingCanvas } from "./canvas.tsx"

const server = vi.hoisted(() => ({
  refuse: null as null | ((words: string) => string | null),
  saves: 0,
  savedWords: [] as string[],
}))

vi.mock("./canvas-save.ts", async (importOriginal) => {
  const real = await importOriginal<typeof import("./canvas-save.ts")>()
  return {
    ...real,
    settlePage: vi.fn(
      async (_doc: string, blocks: readonly { text: string }[]) => {
        const words = real.pageWords(blocks)
        const refused = server.refuse?.(words) ?? null
        if (refused) {
          return { saved: false, words, revision: null, note: refused }
        }
        if (server.savedWords.at(-1) !== words) {
          server.saves += 1
          server.savedWords.push(words)
        }
        const revision = `33333333-3333-4333-8333-${String(server.saves).padStart(12, "0")}`
        return {
          saved: true,
          words,
          revision,
          note: null,
          basis: { revision, words },
        }
      }
    ),
  }
})

const DOC = "11111111-1111-7111-8111-111111111111"
const REVISION = "22222222-2222-4222-8222-222222222222"
const H = {
  title: "a0000000-0000-4000-8000-000000000001",
  intro: "a0000000-0000-4000-8000-000000000002",
  bullet: "a0000000-0000-4000-8000-000000000003",
  city: "a0000000-0000-4000-8000-000000000004",
  link: "a0000000-0000-4000-8000-000000000005",
  after: "a0000000-0000-4000-8000-000000000006",
}
const LINK_TEXT = `${H.link}#0`
const AFTER = "Available from June 2026"

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
      line(H.intro, "Marketing graduate"),
      line(H.bullet, "Exchange term, Lyon", {
        form: { kind: "bullet", level: 0 },
      }),
      line(H.city, "Ho Chi Minh City"),
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
      line(H.after, AFTER),
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

function stored(): string[] {
  const raw = JSON.parse(localStorage.getItem(`opencv-writing:${DOC}`) ?? "{}")
  const draft = raw.draft ?? raw
  return draft.blocks.map((item: { text: string }) => item.text)
}

function status() {
  return screen.getByRole("status").textContent ?? ""
}

function pointAt(id: string, offset: number): [Node, number] {
  const found = block(id)
  const walker = document.createTreeWalker(found, NodeFilter.SHOW_TEXT)
  let left = offset
  let last: Text | null = null
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (left <= node.data.length) return [node, left]
    left -= node.data.length
    last = node
  }
  return last ? [last, last.data.length] : [found, 0]
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

function beforeInput(
  inputType: string,
  extra: { data?: string; text?: string } = {}
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
  return event
}

async function send(event: Event) {
  await act(async () => {
    page().dispatchEvent(event)
  })
  return event
}

function paragraphOf(node: Node) {
  const element = node instanceof Element ? node : node.parentElement
  const found = element?.closest("p")
  if (!found) throw new Error("outside a line")
  return found
}

function browserReplaces(text: string) {
  const selection = document.getSelection()
  const range = selection?.getRangeAt(0)
  if (!selection || !range) throw new Error("no selection")
  const start = paragraphOf(range.startContainer)
  const end = paragraphOf(range.endContainer)
  range.deleteContents()
  if (start !== end) {
    while (end.firstChild) start.appendChild(end.firstChild)
    end.remove()
  }
  const typed = document.createTextNode(text)
  range.insertNode(typed)
  const caret = document.createRange()
  caret.setStart(typed, typed.data.length)
  caret.collapse(true)
  selection.removeAllRanges()
  selection.addRange(caret)
}

async function compose(text: string) {
  await act(async () => {
    fireEvent.compositionStart(page(), { data: "" })
    fireEvent.compositionUpdate(page(), { data: text })
    page().dispatchEvent(beforeInput("insertCompositionText", { data: text }))
    browserReplaces(text)
  })
  await act(async () => {
    fireEvent.compositionEnd(page(), { data: text })
  })
}

async function press(key: string, mods: Record<string, boolean> = {}) {
  await act(async () => {
    page().dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...mods,
      })
    )
  })
}

async function typeAtEndOfAfter(letter: string) {
  select([H.after, block(H.after).textContent?.length ?? 0])
  await send(beforeInput("insertText", { data: letter }))
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

afterEach(() => {
  cleanup()
  localStorage.clear()
  server.refuse = null
  server.saves = 0
  server.savedWords = []
})

const CROSSING: {
  name: string
  from: [string, number]
  to: [string, number]
  note: string
}[] = [
  {
    name: "from a plain line into a numbered line",
    from: [H.intro, 3],
    to: [H.bullet, 4],
    note: NUMBERED_LINE,
  },
  {
    name: "from a plain line into a line with a link",
    from: [H.city, 3],
    to: [LINK_TEXT, 4],
    note: KEPT_PART_LINE,
  },
  {
    name: "out of a numbered line",
    from: [H.bullet, 4],
    to: [H.city, 3],
    note: NUMBERED_LINE,
  },
  {
    name: "out of a line with a link",
    from: [LINK_TEXT, 4],
    to: [H.after, 3],
    note: KEPT_PART_LINE,
  },
  {
    name: "over a whole numbered line",
    from: [H.intro, 3],
    to: [H.city, 3],
    note: NUMBERED_LINE,
  },
  {
    name: "from a numbered line into a line with a link",
    from: [H.bullet, 2],
    to: [LINK_TEXT, 3],
    note: NUMBERED_LINE,
  },
]

const INPUTS: { name: string; run: () => Promise<unknown> }[] = [
  { name: "a composed letter", run: () => compose("đ") },
  {
    name: "a typed letter",
    run: () => send(beforeInput("insertText", { data: "đ" })),
  },
  {
    name: "a paste",
    run: () => send(beforeInput("insertFromPaste", { text: "đ" })),
  },
  { name: "a cut", run: () => send(beforeInput("deleteByCut")) },
  { name: "Backspace", run: () => send(beforeInput("deleteContentBackward")) },
  { name: "Delete", run: () => send(beforeInput("deleteContentForward")) },
]

const CASES = CROSSING.flatMap((selection) =>
  INPUTS.map((input) => ({ ...selection, input: input.name, run: input.run }))
)

describe("a selection that crosses a numbered line or a line with a link", () => {
  it.each(CASES)(
    "$input $name keeps the saved lines, says why, and the next letter elsewhere saves",
    async ({ from, to, note, run }) => {
      open()
      const before = words()
      select(from, to)
      await run()
      expect(words()).toEqual(before)
      expect(stored()).toEqual(before)
      expect(status()).toBe(note)
      await typeAtEndOfAfter("X")
      expect(block(H.after).textContent).toBe(`${AFTER}X`)
      expect(words()).toEqual(stored())
      expect(server.savedWords.at(-1)?.endsWith(`${AFTER}X`)).toBe(true)
      expect(status()).not.toBe(note)
    }
  )

  it.each(INPUTS)(
    "$name inside one numbered line changes its words and saves",
    async ({ name, run }) => {
      open()
      select([H.bullet, 2], [H.bullet, 6])
      await run()
      const changed =
        name === "a composed letter" ||
        name === "a typed letter" ||
        name === "a paste"
          ? "Exđge term, Lyon"
          : "Exge term, Lyon"
      expect(block(H.bullet).textContent).toBe(changed)
      expect(words()).toEqual(stored())
      await typeAtEndOfAfter("X")
      expect(block(H.after).textContent).toBe(`${AFTER}X`)
      expect(words()).toEqual(stored())
    }
  )

  it("does not bring back a refused composed word with Undo", async () => {
    open()
    const before = words()
    select([H.bullet, 2], [LINK_TEXT, 3])
    await compose("đ")
    await press("z", { ctrlKey: true })
    expect(words()).toEqual(before)
    await typeAtEndOfAfter("Y")
    expect(block(H.after).textContent).toBe(`${AFTER}Y`)
    expect(words().join("\n")).not.toContain("Exđ")
  })
})

describe("a phone keyboard that composes every letter", () => {
  async function composeAt(at: [string, number], letters: string) {
    for (const [index, letter] of [...letters].entries()) {
      select([at[0], at[1] + index])
      await compose(letter)
    }
  }

  it("types on a plain line", async () => {
    open()
    await composeAt([H.city, 16], "ab")
    expect(block(H.city).textContent).toBe("Ho Chi Minh Cityab")
    expect(words()).toEqual(stored())
  })

  it("types on a numbered line", async () => {
    open()
    await composeAt([H.bullet, 19], "ab")
    expect(block(H.bullet).textContent).toBe("Exchange term, Lyonab")
    expect(words()).toEqual(stored())
  })

  it("types again at once after a letter over a numbered line is refused", async () => {
    open()
    const before = words()
    select([H.intro, 3], [H.bullet, 4])
    await compose("a")
    expect(words()).toEqual(before)
    expect(status()).toBe(NUMBERED_LINE)
    await composeAt([H.city, 16], "bc")
    expect(block(H.city).textContent).toBe("Ho Chi Minh Citybc")
    expect(words()).toEqual(stored())
    expect(server.savedWords.at(-1)).toContain("Ho Chi Minh Citybc")
  })
})

describe("a save the server refuses", () => {
  it("puts back the saved words, says the change was not kept, and takes the next letter", async () => {
    open()
    select([H.city, 16])
    await send(beforeInput("insertText", { data: "a" }))
    expect(block(H.city).textContent).toBe("Ho Chi Minh Citya")
    server.refuse = (text) =>
      text.includes("Q") ? "This line has mixed formatting." : null
    select([H.city, 17])
    await send(beforeInput("insertText", { data: "Q" }))
    expect(block(H.city).textContent).toBe("Ho Chi Minh Citya")
    expect(stored()).toEqual(words())
    expect(status()).toBe(`${CHANGE_NOT_KEPT} This line has mixed formatting.`)
    await typeAtEndOfAfter("b")
    expect(block(H.after).textContent).toBe(`${AFTER}b`)
    expect(server.savedWords.at(-1)).toContain(`${AFTER}b`)
    await press("z", { ctrlKey: true })
    expect(words().join("\n")).not.toContain("Q")
    await press("z", { ctrlKey: true })
    expect(words().join("\n")).not.toContain("Q")
    await press("z", { ctrlKey: true, shiftKey: true })
    await press("z", { ctrlKey: true, shiftKey: true })
    expect(words().join("\n")).not.toContain("Q")
  })

  it("keeps the words when the server only says the page changed elsewhere", async () => {
    open()
    server.refuse = () =>
      "This Word document has changed. Read it again before editing."
    select([H.city, 16])
    await send(beforeInput("insertText", { data: "a" }))
    expect(block(H.city).textContent).toBe("Ho Chi Minh Citya")
  })
})
