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

  it("pastes three paragraphs into the middle of a line", () => {
    const hello = insertText(
      blankDraft(),
      pointSpan(blankDraft().caret),
      "HelloWorld"
    )
    expect(
      words(
        pastePlain(
          hello,
          pointSpan({ blockId: "p1", offset: 5 }),
          "Alpha one.\nBeta two.\nGamma three."
        )
      )
    ).toEqual(["HelloAlpha one.", "Beta two.", "Gamma three.World"])
  })

  it("keeps a blank line inside a paste", () => {
    const draft = blankDraft()
    expect(words(pastePlain(draft, pointSpan(draft.caret), "a\n\nb"))).toEqual([
      "a",
      "",
      "b",
    ])
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
