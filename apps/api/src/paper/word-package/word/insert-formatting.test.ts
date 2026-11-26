import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import { cvPackage, run } from "../../package-fixtures.js"
import { paragraphsOf, projectParagraphs } from "./classify.js"
import { mutateWord, type WordDraft, type WordSide } from "./mutate.js"

function saved(value: ReturnType<typeof mutateWord>): WordDraft {
  if (value.refused) throw new Error(value.message)
  return value
}

function sidecar(key: string): WordSide {
  return { version: 2, paragraphs: [{ key, ordinal: 0, textIds: [] }] }
}

describe("Enter inherits the trailing Word run regardless of save timing", () => {
  for (const [first, last] of [
    ["<w:b/>", ""],
    ["", "<w:i/><w:u/>"],
    ["<w:i/>", '<w:b/><w:color w:val="336699"/>'],
  ]) {
    it(`inherits ${last || "plain"} after ${first || "plain"}`, () => {
      const key = randomUUID()
      const bytes = cvPackage(
        `<w:p>${run("Lead", first)}${run(" tail", last)}</w:p>`
      )
      const side = sidecar(key)
      const together = saved(
        mutateWord(bytes, side, [{ op: "insert", after: key, text: "Next" }])
      )
      const empty = saved(
        mutateWord(bytes, side, [{ op: "insert", after: key, text: "" }])
      )
      const added = empty.sidecar.paragraphs[1]?.key
      if (!added) throw new Error("missing inserted paragraph")
      const later = saved(
        mutateWord(empty.bytes, empty.sidecar, [
          {
            op: "setText",
            handle: added,
            text: "Next",
            caret: 4,
            lean: "before",
            keptBefore: 0,
          },
        ])
      )
      const pieces = (draft: WordDraft) =>
        projectParagraphs(
          draft.bytes,
          draft.sidecar.paragraphs.map((line) => line.key)
        )?.[1]?.pieces
      expect(pieces(together)).toEqual(pieces(later))
      if (last) {
        expect(paragraphsOf(together.bytes)[1]?.slice).toContain(
          `<w:rPr>${last}</w:rPr>`
        )
        expect(paragraphsOf(later.bytes)[1]?.slice).toContain(
          `<w:rPr>${last}</w:rPr>`
        )
      }
      expect(pieces(together)).toEqual([
        {
          text: "Next",
          editable: true,
          ...(last.includes("w:i")
            ? { marks: ["italic", "underline"] }
            : last.includes("w:b")
              ? { marks: ["bold"] }
              : {}),
        },
      ])
    })
  }
})
