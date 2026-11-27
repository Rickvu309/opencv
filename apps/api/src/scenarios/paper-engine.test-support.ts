import { readFile } from "node:fs/promises"

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
export type Edited = { version: number; activityId: string }
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

export function engineHelpers() {
  async function blank(person: Person, kind: "cv" | "letter" = "cv") {
    const made = dataOf<{ id: string }>(
      await person.run("paper.create", { kind, name: "Engine CV" })
    )
    return made.id
  }

  async function outline(person: Person, docId: string) {
    return dataOf<Outline>(await person.read("paper.outline", { docId }))
  }

  async function edit(person: Person, docId: string, commands: Command[]) {
    const { version } = await outline(person, docId)
    return dataOf<Edited>(
      await person.run("paper.edit", { docId, basedOn: version, commands })
    )
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
    return dataOf<Layout>(
      await person.read("paper.read", {
        docId,
        view: "layout",
        ...(previous === undefined ? {} : { previous }),
      })
    )
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
    written,
    layout,
    exported,
  }
}
