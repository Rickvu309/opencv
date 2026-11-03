import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core"
import type { DefaultReactSuggestionItem } from "@blocknote/react"

const SECTION_TITLE: Record<string, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  activities: "Activities",
  awards: "Awards",
  languages: "Languages",
}

type SlashBlock = {
  id: string
  type: string
  children?: SlashBlock[]
}

type SlashEditor = {
  document: SlashBlock[]
  getTextCursorPosition: () => { block: SlashBlock }
  insertBlocks: (
    blocks: unknown[],
    ref: unknown,
    placement: "before" | "after"
  ) => SlashBlock[]
  setTextCursorPosition: (id: string, pos: "start" | "end") => void
  focus: () => void
}

function editorOf(source: object) {
  return source as unknown as SlashEditor
}

function contains(block: SlashBlock, id: string): boolean {
  return (
    block.children?.some((child) => child.id === id || contains(child, id)) ??
    false
  )
}

function topIndex(blocks: SlashBlock[], id: string) {
  return blocks.findIndex((block) => block.id === id || contains(block, id))
}

export function precededBySection(source: object, blockId: string) {
  const editor = editorOf(source)
  const index = topIndex(editor.document, blockId)
  if (index < 0) return false
  return editor.document
    .slice(0, index)
    .some((block) => block.type === "paperSection")
}

function sectionBlock(kind: string) {
  return {
    type: "paperSection",
    props: { kind },
    content: SECTION_TITLE[kind] ?? "Section",
  }
}

function focusBlock(editor: SlashEditor, id: string | undefined) {
  if (!id) return
  requestAnimationFrame(() => {
    const field = document.querySelector<HTMLElement>(
      `[data-cv-block-fields="${CSS.escape(id)}"] [data-cv-field]`
    )
    if (field) {
      field.focus()
      return
    }
    editor.setTextCursorPosition(id, "start")
    editor.focus()
  })
}

function place(source: object, block: Record<string, unknown>) {
  return insertOrUpdateBlockForSlashMenu(source as never, block as never) as {
    id: string
  }
}

export function ensureCvSection(source: object, kind: string, blockId: string) {
  if (precededBySection(source, blockId)) return
  const editor = editorOf(source)
  editor.insertBlocks([sectionBlock(kind)], blockId, "before")
}

function insertSection(source: object, kind: string) {
  const editor = editorOf(source)
  const marker = place(source, sectionBlock(kind))
  const follow =
    kind === "experience"
      ? { type: "paperExperience" }
      : kind === "education"
        ? { type: "paperEducation" }
        : kind === "skills"
          ? { type: "paperSkills" }
          : { type: "paragraph" }
  const created = editor.insertBlocks([follow], marker.id, "after")
  focusBlock(editor, created[0]?.id ?? marker.id)
}

function insertEntry(source: object, type: string, kind: string) {
  const editor = editorOf(source)
  const current = editor.getTextCursorPosition().block
  ensureCvSection(source, kind, current.id)
  const placed = place(source, { type })
  focusBlock(editor, placed.id)
}

function insertPlain(source: object, block: Record<string, unknown>) {
  const editor = editorOf(source)
  const placed = place(source, block)
  focusBlock(editor, placed.id)
}

function item(
  title: string,
  group: string,
  onItemClick: () => void,
  subtext?: string
): DefaultReactSuggestionItem {
  return { title, group, subtext, onItemClick }
}

export function cvSlashItems(source: object): DefaultReactSuggestionItem[] {
  const section = (kind: string, title: string, subtext?: string) =>
    item(title, "CV sections", () => insertSection(source, kind), subtext)
  return [
    section("summary", "Summary", "2 to 3 lines"),
    section("experience", "Experience"),
    section("education", "Education"),
    section("skills", "Skills"),
    section("projects", "Projects"),
    section("activities", "Activities"),
    section("awards", "Awards"),
    section("languages", "Languages"),
    item("Text", "Blocks", () => insertPlain(source, { type: "paragraph" })),
    item("Heading 2", "Blocks", () =>
      insertPlain(source, { type: "heading", props: { level: 2 } })
    ),
    item("Heading 3", "Blocks", () =>
      insertPlain(source, { type: "heading", props: { level: 3 } })
    ),
    item("Bulleted list", "Blocks", () =>
      insertPlain(source, { type: "bulletListItem" })
    ),
    item("Numbered list", "Blocks", () =>
      insertPlain(source, { type: "numberedListItem" })
    ),
    item("Divider", "Blocks", () => insertPlain(source, { type: "divider" })),
    item("Job", "Blocks", () =>
      insertEntry(source, "paperExperience", "experience")
    ),
    item("School", "Blocks", () =>
      insertEntry(source, "paperEducation", "education")
    ),
    item("Skills", "Blocks", () =>
      insertEntry(source, "paperSkills", "skills")
    ),
  ]
}

export function filterCvSlash<T extends { title: string; subtext?: string }>(
  items: T[],
  query: string
) {
  const needle = query.trim().toLowerCase()
  if (!needle) return items
  return items.filter((entry) =>
    `${entry.title} ${entry.subtext ?? ""}`.toLowerCase().includes(needle)
  )
}
