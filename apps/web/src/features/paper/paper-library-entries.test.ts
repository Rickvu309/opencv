import { describe, expect, it } from "vitest"
import {
  blankCv,
  blankLetter,
  type PaperFile,
  type PaperView,
} from "@workspace/domain/paper-doc"

import {
  LIBRARY_SECTIONS,
  entryName,
  fileBadge,
  libraryEntries,
  librarySections,
} from "./paper-library-entries.ts"

function paper(
  id: string,
  name: string,
  kind: "cv" | "letter",
  templateId: PaperView["templateId"] = "simple"
): PaperView {
  return {
    id: id as PaperView["id"],
    name,
    kind,
    templateId,
    status: "draft",
    paper: kind === "cv" ? blankCv() : blankLetter(),
    contentVersion: 1,
    checks: [],
    pageChoice: "unset",
    isFavorite: false,
    sourceFileId: null,
    createdAt: "2026-11-01T12:00:00.000Z",
    updatedAt: "2026-11-01T12:00:00.000Z",
  }
}

const file: PaperFile = {
  id: "77777777-7777-4777-8777-777777777777" as PaperFile["id"],
  name: "Portfolio.pdf",
  mediaType: "application/pdf",
  byteSize: 42,
  createdAt: "2026-11-01T12:00:00.000Z",
}

const BLANK_PAGE = "11111111-1111-4111-8111-111111111111"
const TEMPLATE_PAGE = "22222222-2222-4222-8222-222222222222"
const LETTER_PAGE = "33333333-3333-4333-8333-333333333333"
const IMPORTED_CV = "44444444-4444-4444-8444-444444444444"
const IMPORTED_LETTER = "55555555-5555-4555-8555-555555555555"
const BLOCK_CV = "66666666-6666-4666-8666-666666666666"
const BLOCK_LETTER = "88888888-8888-4888-8888-888888888888"

const docs = [
  paper(BLANK_PAGE, "Blank CV", "cv"),
  paper(TEMPLATE_PAGE, "Template CV", "cv"),
  paper(LETTER_PAGE, "Letter", "letter", null),
  paper(BLOCK_CV, "Older block CV", "cv"),
  paper(BLOCK_LETTER, "Older block letter", "letter", null),
  paper(IMPORTED_CV, "Imported CV", "cv"),
  paper(IMPORTED_LETTER, "Imported letter", "letter", null),
]

describe("Paper home sections", () => {
  it("shows every kind of document exactly once, in the section of its kind", () => {
    const sections = librarySections(
      libraryEntries({ docs, files: [file] }),
      ""
    )
    const names = (id: "cv" | "letter" | "files") => sections[id].map(entryName)
    expect(names("cv")).toEqual([
      "Blank CV",
      "Template CV",
      "Older block CV",
      "Imported CV",
    ])
    expect(names("letter")).toEqual([
      "Letter",
      "Older block letter",
      "Imported letter",
    ])
    expect(names("files")).toEqual(["Portfolio.pdf"])
    const all = LIBRARY_SECTIONS.flatMap(({ id }) => names(id))
    expect(new Set(all).size).toBe(all.length)
    expect(all).toHaveLength(docs.length + 1)
  })

  it("leaves out a record that is neither a CV nor a Letter instead of failing", () => {
    const odd = { ...paper(BLOCK_CV, "Odd", "cv"), kind: "proof" } as never
    const entries = libraryEntries({ docs: [odd], files: [] })
    expect(entries).toEqual([])
    expect(librarySections(entries, "")).toEqual({
      cv: [],
      letter: [],
      files: [],
    })
  })

  it("filters every section by the search words", () => {
    const sections = librarySections(
      libraryEntries({ docs, files: [file] }),
      "imported"
    )
    expect(sections.cv.map(entryName)).toEqual(["Imported CV"])
    expect(sections.letter.map(entryName)).toEqual(["Imported letter"])
    expect(sections.files).toEqual([])
  })

  it("names a file's type on its sheet", () => {
    expect(fileBadge(file)).toBe("PDF")
    expect(
      fileBadge({
        ...file,
        name: "Old.docx",
        mediaType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    ).toBe("DOCX")
    expect(
      fileBadge({ ...file, name: "notes.rtf", mediaType: "text/rtf" })
    ).toBe("RTF")
  })
})
