import type { PaperFile, PaperView } from "@workspace/domain"

import type { WordDocument } from "./paper-package-library.tsx"

export type LibraryEntry =
  | { type: "paper"; key: string; doc: PaperView; word: WordDocument | null }
  | { type: "word"; key: string; word: WordDocument }
  | { type: "file"; key: string; file: PaperFile }

export type LibrarySectionId = "cv" | "letter" | "files"

export type LibrarySections = Record<LibrarySectionId, LibraryEntry[]>

export const LIBRARY_SECTIONS: readonly {
  id: LibrarySectionId
  title: string
}[] = [
  { id: "cv", title: "CVs" },
  { id: "letter", title: "Letters" },
  { id: "files", title: "Files" },
]

const documentKind = (kind: unknown) => kind === "cv" || kind === "letter"

const matches = (name: string, needle: string) =>
  needle === "" || name.toLowerCase().includes(needle)

export function libraryEntries({
  docs,
  files,
  words,
}: {
  docs: PaperView[]
  files: PaperFile[]
  words: WordDocument[]
}): LibraryEntry[] {
  const papers = docs.filter((doc) => documentKind(doc.kind))
  const wordPages = words.filter((word) => documentKind(word.kind))
  const wordById = new Map(wordPages.map((word) => [word.docId, word]))
  const paperIds = new Set(papers.map((doc) => doc.id as string))
  return [
    ...papers.map((doc): LibraryEntry => ({
      type: "paper",
      key: `paper:${doc.id}`,
      doc,
      word: wordById.get(doc.id) ?? null,
    })),
    ...wordPages
      .filter((word) => !paperIds.has(word.docId))
      .map((word): LibraryEntry => ({
        type: "word",
        key: `word:${word.docId}`,
        word,
      })),
    ...files.map((file): LibraryEntry => ({
      type: "file",
      key: `file:${file.id}`,
      file,
    })),
  ]
}

export function entryName(entry: LibraryEntry) {
  if (entry.type === "paper") return entry.doc.name
  if (entry.type === "word") return entry.word.name
  return entry.file.name
}

export function entrySection(entry: LibraryEntry): LibrarySectionId {
  if (entry.type === "paper") return entry.doc.kind
  if (entry.type === "word") return entry.word.kind
  return "files"
}

export function librarySections(
  entries: LibraryEntry[],
  needle: string
): LibrarySections {
  const sections: LibrarySections = { cv: [], letter: [], files: [] }
  for (const entry of entries)
    if (matches(entryName(entry), needle))
      sections[entrySection(entry)].push(entry)
  return sections
}

export function fileBadge(file: PaperFile) {
  if (file.mediaType === "application/pdf") return "PDF"
  if (file.mediaType.includes("wordprocessingml")) return "DOCX"
  if (file.mediaType === "application/msword") return "DOC"
  const extension = /\.([a-z0-9]{1,5})$/i.exec(file.name)?.[1]
  return extension ? extension.toUpperCase() : "FILE"
}

export function libraryDisplayName(name: string) {
  return name.replace(/\.(docx?|pdf|rtf|txt|odt)$/i, "")
}

export function latestLibraryDocument(entries: readonly LibraryEntry[]) {
  let latest: Exclude<LibraryEntry, { type: "file" }> | undefined
  for (const entry of entries) {
    if (entry.type === "file") continue
    if (
      !latest ||
      (entry.type === "paper" &&
        (latest.type === "word" ||
          Date.parse(entry.doc.updatedAt) > Date.parse(latest.doc.updatedAt)))
    ) {
      latest = entry
    }
  }
  return latest
}
