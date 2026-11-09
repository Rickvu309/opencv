import { describe, expect, it } from "vitest"

import { blankDraft, insertText, pointSpan } from "./canvas-edit.ts"
import { pastePlain, plainCharacters } from "./canvas-paste.ts"

function words(draft: { blocks: { text: string }[] }) {
  return draft.blocks.map((block) => block.text)
}

describe("pastePlain", () => {
  it("treats every return as a line break", () => {
    expect(plainCharacters("a\r\nb\rc")).toBe("a\nb\nc")
  })

  it("splits once when the paste has one break", () => {
    expect(
      words(pastePlain(blankDraft(), pointSpan(blankDraft().caret), "A\nB"))
    ).toEqual(["A", "B"])
  })

  it("refuses a paste with more than one break", () => {
    const draft = blankDraft()
    expect(pastePlain(draft, pointSpan(draft.caret), "a\nb\nc")).toBe(draft)
    const hello = insertText(draft, pointSpan(draft.caret), "Hello")
    expect(pastePlain(hello, pointSpan(hello.caret), "a\n\nb")).toBe(hello)
  })

  it("pastes into the middle of a paragraph", () => {
    const hello = insertText(
      blankDraft(),
      pointSpan(blankDraft().caret),
      "HelloWorld"
    )
    expect(
      words(pastePlain(hello, pointSpan({ blockId: "p1", offset: 5 }), "A\nB"))
    ).toEqual(["HelloA", "BWorld"])
  })

  it("does not eat a character when the caret is collapsed", () => {
    const hello = insertText(
      blankDraft(),
      pointSpan(blankDraft().caret),
      "Hello"
    )
    expect(words(pastePlain(hello, pointSpan(hello.caret), "!"))).toEqual([
      "Hello!",
    ])
  })

  it("replaces a selection with the pasted words", () => {
    const hello = insertText(
      blankDraft(),
      pointSpan(blankDraft().caret),
      "Hello"
    )
    expect(
      words(
        pastePlain(
          hello,
          {
            anchor: { blockId: "p1", offset: 1 },
            focus: { blockId: "p1", offset: 4 },
          },
          "i"
        )
      )
    ).toEqual(["Hio"])
  })
})
