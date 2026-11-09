import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"

import { render } from "@/test/render-with-client.tsx"

import { WritingCanvas } from "./canvas.tsx"

const DOC = "11111111-1111-7111-8111-111111111111"

function page() {
  const article = screen.getByRole("article", { name: "Page" })
  if (!(article instanceof HTMLElement)) throw new Error("missing page")
  return article
}

function words() {
  return [...page().querySelectorAll(":scope > p")].map((block) =>
    (block.textContent ?? "").replaceAll("\u200b", "")
  )
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

async function paste(value: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true })
  Object.defineProperty(event, "clipboardData", {
    value: { getData: () => value },
  })
  await act(async () => {
    page().dispatchEvent(event)
  })
}

async function pressBackward() {
  await act(async () => {
    page().dispatchEvent(
      new InputEvent("beforeinput", {
        inputType: "deleteContentBackward",
        bubbles: true,
        cancelable: true,
      })
    )
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe("WritingCanvas", () => {
  it("opens a blank page and says the writing is not saved yet", () => {
    render(<WritingCanvas docId={DOC} />)
    expect(words()).toEqual([""])
    expect(screen.getByRole("status").textContent).toBe(
      "Writing is not saved yet. A copy stays on this computer."
    )
    expect(screen.getByRole("status").textContent).not.toMatch(/\bSaved\b/)
    expect(page().querySelector("input, textarea, button")).toBeNull()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("types, starts a paragraph, joins it, and undoes that", async () => {
    render(<WritingCanvas docId={DOC} />)
    await typeText("Hello")
    fireEvent.keyDown(page(), { key: "Enter" })
    await typeText("World")
    expect(words()).toEqual(["Hello", "World"])
    await pressBackward()
    await pressBackward()
    await pressBackward()
    await pressBackward()
    await pressBackward()
    await pressBackward()
    expect(words()).toEqual(["Hello"])
    fireEvent.keyDown(page(), { key: "z", metaKey: true })
    expect(words()).toEqual(["Hello", ""])
  })

  it("deletes a selection that crosses paragraphs", async () => {
    render(<WritingCanvas docId={DOC} />)
    await typeText("Hello")
    fireEvent.keyDown(page(), { key: "Enter" })
    await typeText("World")
    const blocks = [...page().querySelectorAll(":scope > p")]
    const first = blocks[0]?.firstChild
    const second = blocks[1]?.firstChild
    if (!first || !second) throw new Error("missing text")
    vi.spyOn(document, "getSelection").mockReturnValue({
      rangeCount: 1,
      anchorNode: first,
      anchorOffset: 2,
      focusNode: second,
      focusOffset: 1,
      removeAllRanges() {},
      addRange() {},
    } as unknown as Selection)
    await pressBackward()
    expect(words()).toEqual(["Heorld"])
  })

  it("splits on one pasted break and refuses two", async () => {
    render(<WritingCanvas docId={DOC} />)
    await paste("A\nB")
    expect(words()).toEqual(["A", "B"])
    await paste("a\nb\nc")
    expect(words()).toEqual(["A", "B"])
  })

  it("commits a composed word and then splits on Enter", () => {
    render(<WritingCanvas docId={DOC} />)
    fireEvent.compositionStart(page())
    const enter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(enter, "keyCode", { get: () => 229 })
    page().dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)
    expect(words()).toEqual([""])
    fireEvent.compositionEnd(page(), { data: "漢字" })
    expect(words()).toEqual(["漢字", ""])
  })

  it("commits a composed word in a paragraph that already has text, then splits", async () => {
    render(<WritingCanvas docId={DOC} />)
    await typeText("Hello")
    fireEvent.compositionStart(page())
    const enter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(enter, "keyCode", { get: () => 229 })
    page().dispatchEvent(enter)
    expect(words()).toEqual(["Hello"])
    fireEvent.compositionEnd(page(), { data: "Việt" })
    expect(words()).toEqual(["HelloViệt", ""])
  })

  it("keeps each paper's copy when the document changes", async () => {
    const other = "22222222-2222-7222-8222-222222222222"
    localStorage.setItem(
      `opencv-writing:${other}`,
      JSON.stringify({
        blocks: [{ id: "p1", text: "Ada" }],
        caret: { blockId: "p1", offset: 3 },
        nextId: 2,
      })
    )
    const view = render(<WritingCanvas docId={DOC} />)
    await typeText("Grace")
    expect(localStorage.getItem(`opencv-writing:${DOC}`)).toContain("Grace")
    view.rerender(<WritingCanvas docId={other} />)
    expect(words()).toEqual(["Ada"])
    expect(localStorage.getItem(`opencv-writing:${other}`)).toContain("Ada")
    expect(localStorage.getItem(`opencv-writing:${other}`)).not.toContain(
      "Grace"
    )
    expect(localStorage.getItem(`opencv-writing:${DOC}`)).toContain("Grace")
  })

  it("does not split twice when the browser already made the paragraph", () => {
    render(<WritingCanvas docId={DOC} />)
    const article = page()
    fireEvent.compositionStart(article)
    fireEvent.keyDown(article, { key: "Enter", isComposing: true })
    const extra = document.createElement("p")
    extra.textContent = "next"
    article.appendChild(extra)
    fireEvent.compositionEnd(article, { data: "漢字" })
    expect(words()).toEqual(["漢字", "next"])
  })

  it("keeps the words on this computer", async () => {
    const view = render(<WritingCanvas docId={DOC} />)
    await typeText("Kept")
    expect(localStorage.getItem(`opencv-writing:${DOC}`)).toContain("Kept")
    view.unmount()
    render(<WritingCanvas docId={DOC} />)
    expect(words()).toEqual(["Kept"])
  })

  it("keeps a spelling fix already on the page", async () => {
    render(<WritingCanvas docId={DOC} />)
    await typeText("Helo")
    const block = page().querySelector("p")
    if (!block) throw new Error("missing paragraph")
    block.textContent = "Hello"
    const text = block.firstChild
    if (!text) throw new Error("missing text")
    const range = document.createRange()
    range.setStart(text, 0)
    range.collapse(true)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    await typeText("!")
    expect(words()).toEqual(["!Hello"])
  })

  it("says a reload clears the words when the copy cannot be kept", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full")
    })
    render(<WritingCanvas docId={DOC} />)
    expect(await screen.findByText(/A reload clears these words/)).toBeVisible()
  })
})
