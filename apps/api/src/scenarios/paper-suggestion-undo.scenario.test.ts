import { delegateActorSchema } from "@workspace/domain/kernel"
import { paperEngineBlank, type Document } from "@workspace/domain/paper-doc"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createDemoCoachRuntime } from "../coach/index.js"
import { agentConnections, oauthClient } from "../db/schema.js"
import { serverPaperLog } from "../paper/log/index.js"
import { createId } from "../platform/id.js"
import {
  dataOf,
  failureOf,
  openWorld,
  type Person,
  type World,
} from "./person.test-support.js"
import { span, type Command } from "./paper-engine.test-support.js"

let world: World
let agents = 0

beforeAll(async () => {
  world = await openWorld({ coach: createDemoCoachRuntime() })
})

afterAll(async () => {
  await world.close()
})

async function connectAgent(person: Person) {
  agents += 1
  const connectionId = createId()
  const clientId = `undo-client-${agents}`
  await world.db.insert(oauthClient).values({
    id: clientId,
    clientId,
    redirectUris: ["http://localhost/callback"],
  })
  await world.db.insert(agentConnections).values({
    id: connectionId,
    userId: person.id,
    clientId,
    authorizationCodeId: `undo-authorization-${agents}`,
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

async function engineLines(person: Person, docId: string) {
  const read = dataOf<{ revision: number; outline: string; engine?: number }>(
    await person.read("paper.outline", { docId })
  )
  expect(read.engine).toBe(2)
  const blocks = JSON.parse(read.outline) as { id: string; text: string }[]
  return {
    version: read.revision,
    blocks,
    texts: blocks.map((block) => block.text),
  }
}

async function engineWritten(person: Person, lines: string[]) {
  const docId = dataOf<{ id: string }>(
    await person.run("paper.create", { kind: "cv", name: "Engine CV" })
  ).id
  const blank = paperEngineBlank.blankCv()
  const template = blank.content[0]!
  const doc = {
    ...blank,
    content: lines.map((text, index) => ({
      ...template,
      attrs: { ...template.attrs, id: `line-${index + 1}` },
      content: [{ type: "text", text }],
    })),
  } as unknown as Document
  expect(await world.inside(() => serverPaperLog.start(docId, doc))).toEqual({
    ok: true,
  })
  return { docId, blocks: (await engineLines(person, docId)).blocks }
}

async function suggest(person: Person, docId: string, commands: Command[]) {
  const agent = await connectAgent(person)
  const { version } = await engineLines(person, docId)
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

describe("accepted Coach Suggestions are taken back newest first", () => {
  it("asks to take back the newer accepted Suggestion first, then takes back both (#2251)", async () => {
    const ada = await world.person("Ada")
    const { docId, blocks } = await engineWritten(ada, [
      "Built dashboards",
      "Python",
    ])
    const accept = async (block: number, expect: string, text: string) =>
      dataOf<{ id: string }>(
        await ada.run("actions.approve", {
          pendingActionId: await suggest(ada, docId, [
            {
              op: "replaceText",
              range: span(blocks[block]!.id, 0, expect.length),
              text,
              expect,
            },
          ]),
        })
      ).id
    const older = await accept(0, "Built", "Shipped")
    const newer = await accept(1, "Python", "Go")
    const refused = failureOf(await ada.undo(older))
    expect(refused.message).toBe(
      "Undo was skipped: take back the newer Coach change on this Paper first."
    )
    expect((await ada.undo(newer)).status).toBe(200)
    expect((await ada.undo(older)).status).toBe(200)
    expect((await engineLines(ada, docId)).texts).toEqual([
      "Built dashboards",
      "Python",
    ])
  })
})
