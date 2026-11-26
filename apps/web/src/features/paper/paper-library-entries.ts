import type { PaperFile, PaperView } from "@workspace/domain/paper-doc"

export type LibraryEntry =
  | { type: "paper"; key: string; doc: PaperView }
  | { type: "file"; key: string; file: PaperFile }

export type LibrarySectionId = "cv" | "letter" | "files"

export type LibraryView = "all" | "proofs" | LibrarySectionId

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
}: {
  docs: PaperView[]
  files: PaperFile[]
}): LibraryEntry[] {
  return [
    ...docs
      .filter((doc) => documentKind(doc.kind))
      .map((doc): LibraryEntry => ({
        type: "paper",
        key: `paper:${doc.id}`,
        doc,
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
  return entry.file.name
}

export function entrySection(entry: LibraryEntry): LibrarySectionId {
  if (entry.type === "paper") return entry.doc.kind
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
