import {
  blankCv,
  blankLetter,
  parsePaperId,
  type CvPaper,
  type PaperView,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

import {
  blankDraft,
  clearedOnReload,
  draftFromRegions,
  commitComposition,
  deleteBackward,
  deleteForward,
  insertText,
  keptOnThisComputer,
  loadDraft,
  opensWritingCanvas,
  pointSpan,
  replaceVisible,
  splitParagraph,
  storeDraft,
  type WritingDraft,
} from "./canvas-edit.ts"

const DOC = "11111111-1111-7111-8111-111111111111"

function cv(paper: CvPaper = blankCv()): PaperView {
  return {
    id: parsePaperId(DOC),
    name: "Draft",
    kind: "cv",
    templateId: "simple",
    status: "draft",
    paper,
    contentVersion: 1,
    checks: [],
    pageChoice: "unset",
    isFavorite: false,
    sourceFileId: null,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
  }
}

function words(draft: WritingDraft) {
  return draft.blocks.map((block) => block.text)
}

function helloWorld() {
  const hello = insertText(blankDraft(), pointSpan(blankDraft().caret), "Hello")
  const split = splitParagraph(hello, pointSpan(hello.caret))
  return insertText(split, pointSpan(split.caret), "World")
}

describe("opensWritingCanvas", () => {
  it("opens a new CV that is still only empty section markers", () => {
    expect(opensWritingCanvas(cv())).toBe(true)
  })

  it("leaves a letter on the letter editor", () => {
    expect(
      opensWritingCanvas({
        ...cv(),
        kind: "letter",
        templateId: null,
        paper: blankLetter(),
      })
    ).toBe(false)
  })

  it("leaves a CV that already has a name, a photo, a paragraph, or a file", () => {
    const named = blankCv()
    expect(
      opensWritingCanvas(
        cv({ ...named, header: { ...named.header, name: "Ada" } })
      )
    ).toBe(false)
    const photo = blankCv()
    expect(
      opensWritingCanvas(
        cv({
          ...photo,
          header: {
            ...photo.header,
            photo: {} as NonNullable<CvPaper["header"]["photo"]>,
          },
        })
      )
    ).toBe(false)
    const started = blankCv()
    expect(
      opensWritingCanvas(
        cv({
          ...started,
          blocks: [
            ...started.blocks,
            {
              id: "body-1",
              type: "paragraph",
              content: [{ text: "Hello" }],
            } as CvPaper["blocks"][number],
          ],
        })
      )
    ).toBe(false)
    expect(
      opensWritingCanvas({
        ...cv(),
        sourceFileId: parsePaperId(
          "22222222-2222-4222-8222-222222222222"
        ) as unknown as PaperView["sourceFileId"],
      })
    ).toBe(false)
  })

  it("leaves a document that has no paper on its own editor", () => {
    expect(
      opensWritingCanvas({
        ...cv(),
        paper: undefined as unknown as PaperView["paper"],
      })
    ).toBe(false)
  })
})

describe("writing draft", () => {
  it("types, splits, and joins paragraphs", () => {
    const draft = helloWorld()
    expect(words(draft)).toEqual(["Hello", "World"])
    const joined = deleteBackward(
      draft,
      pointSpan({ blockId: "p2", offset: 0 })
    )
    expect(words(joined)).toEqual(["HelloWorld"])
    expect(joined.caret).toEqual({ blockId: "p1", offset: 5 })
  })

  it("does not remove the first paragraph", () => {
    const draft = insertText(
      blankDraft(),
      pointSpan(blankDraft().caret),
      "Hello"
    )
    const kept = deleteBackward(draft, pointSpan({ blockId: "p1", offset: 0 }))
    expect(words(kept)).toEqual(["Hello"])
    expect(kept.caret).toEqual({ blockId: "p1", offset: 0 })
  })

  it("deletes one character and does not merge at the end", () => {
    const draft = helloWorld()
    const trimmed = deleteForward(
      draft,
      pointSpan({ blockId: "p1", offset: 4 })
    )
    expect(words(trimmed)).toEqual(["Hell", "World"])
    const held = deleteForward(trimmed, pointSpan({ blockId: "p1", offset: 4 }))
    expect(words(held)).toEqual(["Hell", "World"])
    expect(held.caret).toEqual({ blockId: "p1", offset: 4 })
  })

  it("removes only an empty paragraph", () => {
    const split = splitParagraph(
      helloWorld(),
      pointSpan({ blockId: "p2", offset: 0 })
    )
    expect(words(split)).toEqual(["Hello", "", "World"])
    const removed = deleteForward(
      split,
      pointSpan({ blockId: "p2", offset: 0 })
    )
    expect(words(removed)).toEqual(["Hello", "World"])
    expect(removed.caret).toEqual({ blockId: "p1", offset: 5 })
    const only = blankDraft()
    const kept = deleteForward(only, pointSpan(only.caret))
    expect(words(kept)).toEqual([""])
    expect(kept.blocks).toHaveLength(1)
    expect(
      words(deleteBackward(split, pointSpan({ blockId: "p2", offset: 0 })))
    ).toEqual(["Hello", "World"])
  })

  it("deletes a selection that crosses paragraphs", () => {
    const cleared = deleteBackward(helloWorld(), {
      anchor: { blockId: "p1", offset: 2 },
      focus: { blockId: "p2", offset: 1 },
    })
    expect(words(cleared)).toEqual(["Heorld"])
    expect(cleared.caret).toEqual({ blockId: "p1", offset: 2 })
  })

  it("refuses a newline inside a single insert", () => {
    const draft = blankDraft()
    expect(insertText(draft, pointSpan(draft.caret), "a\nb")).toBe(draft)
  })

  it("commits a composed word and then splits", () => {
    const draft = commitComposition(blankDraft(), "漢字", true)
    expect(words(draft)).toEqual(["漢字", ""])
    expect(draft.caret).toEqual({ blockId: "p2", offset: 0 })
    expect(words(commitComposition(blankDraft(), "漢字", false))).toEqual([
      "漢字",
    ])
  })

  it("drops the blank-line marker when the page is read back", () => {
    expect(
      words(
        replaceVisible(blankDraft(), [{ id: "p1", text: "\u200bHi\u200b" }], {
          blockId: "p1",
          offset: 2,
        })
      )
    ).toEqual(["Hi"])
  })

  it("keeps a local copy and rejects a broken one", () => {
    const memory = new Map<string, string>()
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
    }
    const draft = insertText(blankDraft(), pointSpan(blankDraft().caret), "Hi")
    expect(storeDraft(DOC, draft, storage)).toBe(true)
    expect(loadDraft(DOC, storage)).toEqual(draft)
    memory.set(`opencv-writing:${DOC}`, "{")
    expect(loadDraft(DOC, storage)).toBeNull()
    expect(
      storeDraft(DOC, draft, {
        setItem() {
          throw new Error("full")
        },
      })
    ).toBe(false)
  })

  it("seeds the empty paragraph id and skips the section carrier", () => {
    const writing = "a11a11a1-a11a-4a11-8a11-a11a11a11a11"
    const carrier = "b22b22b2-b22b-4b22-8b22-b22b22b22b22"
    expect(
      draftFromRegions([
        {
          kind: "locked",
          text: "",
          paragraph: writing,
          reason: { code: "EMPTY_TARGET" },
        },
        {
          kind: "locked",
          text: "",
          paragraph: carrier,
          reason: { code: "UNSUPPORTED_TARGET_PROPERTY" },
        },
      ])
    ).toEqual({
      blocks: [{ id: writing, text: "" }],
      caret: { blockId: writing, offset: 0 },
      nextId: 2,
    })
    expect(draftFromRegions([])).toBeNull()
    expect(
      draftFromRegions([
        {
          kind: "editable",
          text: "Hi",
          paragraph: writing,
        },
        {
          kind: "editable",
          text: " there",
          paragraph: writing,
        },
      ])?.blocks
    ).toEqual([{ id: writing, text: "Hi there" }])
  })

  it("says the writing is not saved yet", () => {
    expect(keptOnThisComputer()).toBe(
      "Writing is not saved yet. A copy stays on this computer."
    )
    expect(clearedOnReload()).toBe(
      "Writing is not saved yet. A reload clears these words."
    )
    expect(keptOnThisComputer()).not.toMatch(/\bSaved\b/)
    expect(clearedOnReload()).not.toMatch(/\bSaved\b/)
  })
})
