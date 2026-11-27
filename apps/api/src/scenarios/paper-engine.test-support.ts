import { delegateActorSchema } from "@workspace/domain/kernel"
import { expect } from "vitest"

import { agentConnections, oauthClient } from "../db/schema.js"
import { createId } from "../platform/id.js"
import { dataOf, type Person, type World } from "./person.test-support.js"

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

export async function pdfPages(bytes: Buffer) {
  const unpdf = await import("unpdf")
  const pdf = await unpdf.getDocumentProxy(new Uint8Array(bytes))
  const { text } = await unpdf.extractText(pdf, { mergePages: false })
  return text
}

export const texts = (o: Outline) => o.blocks.map((block) => block.text)

export function engineHelpers(world: World) {
  let agents = 0

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

  async function connectAgent(person: Person) {
    agents += 1
    const connectionId = createId()
    const clientId = `engine-client-${agents}`
    await world.db.insert(oauthClient).values({
      id: clientId,
      clientId,
      redirectUris: ["http://localhost/callback"],
    })
    await world.db.insert(agentConnections).values({
      id: connectionId,
      userId: person.id,
      clientId,
      authorizationCodeId: `engine-authorization-${agents}`,
      name: "Paper agent",
      audience: "http://localhost/mcp",
      scopes: ["connection.status", "paper.read", "paper.write"],
      resources: { kind: "paper" },
      policy: { reads: "allow", writes: "approval" },
      expiresAt: new Date(Date.now() + 600_000),
    })
    return delegateActorSchema.parse({
      type: "delegate",
      userId: person.id,
      connectionId,
      name: "Paper agent",
      scopes: ["paper.read", "paper.write"],
      resources: "paper",
      reads: "allow",
      writes: "approval",
    })
  }

  async function suggest(person: Person, docId: string, commands: Command[]) {
    const agent = await connectAgent(person)
    const { version } = await outline(person, docId)
    const proposed = await world.inside(() =>
      world.registry.execute({
        name: "paper.edit",
        input: { docId, basedOn: version, commands },
        actor: agent,
      })
    )
    expect(proposed.pending).toBe(true)
    return proposed.pendingActionId as string
  }

  return {
    blank,
    outline,
    edit,
    written,
    layout,
    exported,
    connectAgent,
    suggest,
  }
}
