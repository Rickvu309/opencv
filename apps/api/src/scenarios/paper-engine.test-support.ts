import { readFile } from "node:fs/promises"

import type { Change, Document } from "@workspace/domain/paper-doc"
import {
  createEngine,
  createLayouter,
  fixedClock,
  layoutWork,
  paperFontMetrics,
  seededIds,
  type EditorState,
  type PaperEngine,
} from "@workspace/paper-engine"

import { dataOf, type Person } from "./person.test-support.js"

export type Mark = { type: string; from: number; to: number; href?: string }
export type OutlineBlock = {
  id: string
  kind: string
  list: "bullet" | "numbered" | null
  level: number
  text: string
  marks: Mark[]
}
export type Outline = {
  version: number
  page: { size: string; orientation: string }
  blocks: OutlineBlock[]
}
export type Pos = { block: string; offset: number }
export type Command = Record<string, unknown> & { op: string }
export type LaidOutPage = { lines: { block: string; text: string }[] }
export type Layout = {
  version: number
  pages: LaidOutPage[]
  work: { blocksLaidOut: number; pagesPaginated: number }
}
export type Exported = { contentType: string; base64: string }

export async function importCorpus(person: Person, name: string, key?: string) {
  const bytes = await readFile(
    new URL(
      `../../../../packages/paper-corpus/tests/fixtures/cvs/${name}.docx`,
      import.meta.url
    )
  )
  return importWord(person, `${name}.docx`, bytes, key)
}

export async function importWord(
  person: Person,
  name: string,
  bytes: Uint8Array,
  key?: string
) {
  const form = new FormData()
  form.set("file", new Blob([new Uint8Array(bytes)]), name)
  return dataOf<{ docId: string; dropped: string[] }>(
    await person.upload("/api/paper/import?engine=2", form, key)
  )
}

export const at = (block: string, offset: number): Pos => ({ block, offset })
export const span = (block: string, from: number, to: number) => ({
  from: at(block, from),
  to: at(block, to),
})
export const paragraph = (
  text: string,
  kind = "paragraph",
  list: string | null = null
) => ({
  type: "text_block",
  attrs: { kind, list, level: 0 },
  content: text ? [{ type: "text", text }] : [],
})

export const texts = (o: Outline) => o.blocks.map((block) => block.text)

type EngineView = { doc: Document; version: number }

function outlineOf({ doc, version }: EngineView): Outline {
  return {
    version,
    page: {
      size: doc.attrs.page.size,
      orientation: doc.attrs.page.orientation,
    },
    blocks: doc.content.flatMap((block) => {
      if (block.type !== "text_block") return []
      let text = ""
      const marks: Mark[] = []
      for (const run of block.content ?? []) {
        const piece = run.type === "text" ? run.text : "\n"
        for (const mark of run.type === "text" ? (run.marks ?? []) : []) {
          const href = mark.type === "link" ? mark.attrs.href : undefined
          const last = [...marks]
            .reverse()
            .find((open) => open.type === mark.type && open.href === href)
          if (last && last.to === text.length) last.to += piece.length
          else
            marks.push({
              type: mark.type,
              from: text.length,
              to: text.length + piece.length,
              ...(href === undefined ? {} : { href }),
            })
        }
        text += piece
      }
      return [
        {
          id: block.attrs.id,
          kind: block.attrs.kind,
          list: block.attrs.list,
          level: block.attrs.level,
          text,
          marks,
        },
      ]
    }),
  }
}

export function engineHelpers() {
  const editor = createEngine({
    ids: seededIds("scenario-tab"),
    now: fixedClock(),
  })
  const layouter = createLayouter(paperFontMetrics)
  const layouts = new Map<
    string,
    Map<number, ReturnType<typeof layouter.layout>>
  >()

  async function blank(person: Person, kind: "cv" | "letter" = "cv") {
    const made = dataOf<{ id: string }>(
      await person.run("paper.create", { kind, name: "Engine CV" })
    )
    return made.id
  }

  async function engineView(person: Person, docId: string) {
    return dataOf<EngineView>(
      await person.read("paper.read", { docId, view: "engine" })
    )
  }

  async function outline(person: Person, docId: string) {
    return outlineOf(await engineView(person, docId))
  }

  const tabs = new Map<string, EditorState>()

  async function save(
    person: Person,
    docId: string,
    base: number,
    result: { state: EditorState; change: Change }
  ) {
    const client = `tab-${person.id}`
    const saved = dataOf<{ ok: true; head: number }>(
      await person.run("paper.save", {
        docId,
        client,
        base,
        changes: [result.change],
      })
    )
    tabs.set(docId, editor.receive(result.state, [result.change]).state)
    return saved
  }

  let pasted = 0
  const pastedBlock = (block: Record<string, unknown>) =>
    block.type === "text_block"
      ? {
          ...block,
          attrs: {
            id: `pasted-${++pasted}`,
            align: "left",
            lineSpacing: null,
            keepWithNext: null,
            ...(block.attrs as object),
          },
        }
      : block

  const tabCommand = (command: Command) =>
    command.op === "pasteFragment"
      ? {
          ...command,
          fragment: (command.fragment as Record<string, unknown>[]).map(
            pastedBlock
          ),
        }
      : command

  async function edit(person: Person, docId: string, commands: Command[]) {
    const { doc, version } = await engineView(person, docId)
    const client = `tab-${person.id}`
    const kept = tabs.get(docId)
    const state =
      kept && editor.saved(kept).version === version
        ? kept
        : editor.load(doc, version, client)
    const result = editor.run(
      state,
      commands.map(tabCommand) as unknown as Parameters<PaperEngine["run"]>[1],
      { kind: "person", actor: person.id, client }
    )
    if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
    return save(person, docId, version, result)
  }

  async function undo(person: Person, docId: string) {
    const state = tabs.get(docId)
    const result = state && editor.undo(state)
    if (!result) throw new Error("Nothing to undo")
    return save(person, docId, editor.saved(state).version, result)
  }

  async function written(person: Person, lines: string[], kind = "paragraph") {
    const docId = await blank(person)
    const first = (await outline(person, docId)).blocks[0]!
    await edit(person, docId, [
      {
        op: "pasteFragment",
        range: span(first.id, 0, 0),
        fragment: lines.map((line) => paragraph(line, kind)),
      },
    ])
    return { docId, blocks: (await outline(person, docId)).blocks }
  }

  async function layout(person: Person, docId: string, previous?: number) {
    const view = await engineView(person, docId)
    const tab = tabs.get(docId)
    const { doc, version } =
      tab && editor.saved(tab).version === view.version
        ? { doc: editor.read(tab).doc, version: view.version }
        : view
    const seen = layouts.get(docId) ?? new Map()
    layouts.set(docId, seen)
    const laid = layouter.layout(
      doc,
      previous === undefined ? null : (seen.get(previous) ?? null)
    )
    seen.set(version, laid)
    return {
      version,
      work: layoutWork(laid),
      pages: laid.pages.map((page) => ({
        lines: page.boxes.flatMap((box) =>
          box.kind === "line"
            ? [
                {
                  block: box.block,
                  text: box.segments.map((part) => part.text).join(""),
                },
              ]
            : []
        ),
      })),
    } satisfies Layout
  }

  async function exported(
    person: Person,
    docId: string,
    format: "pdf" | "docx"
  ) {
    const file = dataOf<Exported>(
      await person.read("paper.export", { docId, format })
    )
    return { ...file, bytes: Buffer.from(file.base64, "base64") }
  }

  return {
    blank,
    outline,
    edit,
    undo,
    written,
    layout,
    exported,
  }
}
