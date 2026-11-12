import { describe, expect, it } from "vitest"
import {
  blankCv,
  blankLetter,
  paperPackageMetadataSchema,
  type PaperFile,
  type PaperView,
} from "@workspace/domain"

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

function word(docId: string, name: string, kind: "cv" | "letter") {
  return paperPackageMetadataSchema.parse({
    generation: "package",
    docId,
    revision: "99999999-9999-4999-8999-999999999999",
    name,
    kind,
    packageHash: "b".repeat(64),
    byteSize: 2048,
  })
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
  paper(BLANK_PAGE, "Blank Word CV", "cv"),
  paper(TEMPLATE_PAGE, "Template Word CV", "cv"),
  paper(LETTER_PAGE, "Word Letter", "letter", null),
  paper(BLOCK_CV, "Older block CV", "cv"),
  paper(BLOCK_LETTER, "Older block letter", "letter", null),
]

const words = [
  word(BLANK_PAGE, "Blank Word CV", "cv"),
  word(TEMPLATE_PAGE, "Template Word CV", "cv"),
  word(LETTER_PAGE, "Word Letter", "letter"),
  word(IMPORTED_CV, "Imported CV.docx", "cv"),
  word(IMPORTED_LETTER, "Imported letter.docx", "letter"),
]

describe("Paper home sections", () => {
  it("shows every kind of document exactly once, in the section of its kind", () => {
    const sections = librarySections(
      libraryEntries({ docs, files: [file], words }),
      ""
    )
    const names = (id: "cv" | "letter" | "files") => sections[id].map(entryName)
    expect(names("cv")).toEqual([
      "Blank Word CV",
      "Template Word CV",
      "Older block CV",
      "Imported CV.docx",
    ])
    expect(names("letter")).toEqual([
      "Word Letter",
      "Older block letter",
      "Imported letter.docx",
    ])
    expect(names("files")).toEqual(["Portfolio.pdf"])
    const all = LIBRARY_SECTIONS.flatMap(({ id }) => names(id))
    expect(new Set(all).size).toBe(all.length)
    expect(all).toHaveLength(docs.length + 2 + 1)
  })

  it("draws a Word CV made from a template once, though both lists return it", () => {
    const fromTemplate = paper(TEMPLATE_PAGE, "Template Word CV", "cv")
    const sameInWordList = word(TEMPLATE_PAGE, "Template Word CV", "cv")
    const entries = libraryEntries({
      docs: [fromTemplate],
      files: [],
      words: [sameInWordList],
    })
    const ids = entries.map((entry) =>
      entry.type === "paper"
        ? entry.doc.id
        : entry.type === "word"
          ? entry.word.docId
          : entry.file.id
    )
    expect(ids).toEqual([TEMPLATE_PAGE])
    expect(librarySections(entries, "").cv).toHaveLength(1)
  })

  it("keeps a Word page's text preview on its one card", () => {
    const entries = libraryEntries({ docs, files: [], words })
    const blank = entries.find(
      (entry) => entry.type === "paper" && entry.doc.id === BLANK_PAGE
    )
    expect(blank?.type === "paper" ? blank.word?.docId : null).toBe(BLANK_PAGE)
    const older = entries.find(
      (entry) => entry.type === "paper" && entry.doc.id === BLOCK_CV
    )
    expect(older?.type === "paper" ? older.word : "missing").toBeNull()
  })

  it("leaves out a record that is neither a CV nor a Letter instead of failing", () => {
    const odd = { ...paper(BLOCK_CV, "Odd", "cv"), kind: "proof" } as never
    const oddWord = { ...word(IMPORTED_CV, "Odd word", "cv"), kind: undefined }
    const entries = libraryEntries({
      docs: [odd],
      files: [],
      words: [oddWord as never],
    })
    expect(entries).toEqual([])
    expect(librarySections(entries, "")).toEqual({
      cv: [],
      letter: [],
      files: [],
    })
  })

  it("filters every section by the search words", () => {
    const sections = librarySections(
      libraryEntries({ docs, files: [file], words }),
      "imported"
    )
    expect(sections.cv.map(entryName)).toEqual(["Imported CV.docx"])
    expect(sections.letter.map(entryName)).toEqual(["Imported letter.docx"])
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
