import { expect, it } from "vitest"
import type { WordPage, WordParagraph } from "@workspace/domain"

import { diffParagraphs } from "@/features/paper-page/page-diff.ts"
import { blocksForLetterLines } from "./paper-letter-continue.ts"

const DOC = "11111111-1111-4111-8111-111111111111"
const REVISION = "22222222-2222-4222-8222-222222222222"
const HANDLE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

function line(handle: string, text: string): WordParagraph {
  return {
    handle,
    text,
    pieces: text === "" ? [] : [{ text, editable: true }],
    held: false,
    message: "",
    code: null,
  }
}

function pageOf(paragraph: WordParagraph): WordPage {
  return {
    doc: DOC,
    revision: REVISION,
    name: "Letter.docx",
    label: "letter",
    paragraphs: [paragraph],
  }
}

it("writes a stopped letter into the blank page that is already open", () => {
  const page = pageOf(line(HANDLE, ""))
  const diff = diffParagraphs(
    page,
    blocksForLetterLines(page, ["Dear hiring team,", "I am writing."]),
    null
  )
  expect(diff).toEqual({
    ops: [
      { op: "setText", handle: HANDLE, text: "Dear hiring team," },
      { op: "insert", after: HANDLE, text: "I am writing." },
    ],
  })
})
