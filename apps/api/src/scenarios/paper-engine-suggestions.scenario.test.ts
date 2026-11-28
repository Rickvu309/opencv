import { delegateActorSchema } from "@workspace/domain/kernel"
import {
  paperEngineBlank,
  type BlockId,
  type DocCommand,
  type Document,
} from "@workspace/domain/paper-doc"
import { createEngine } from "@workspace/paper-engine"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createDemoCoachRuntime } from "../coach/index.js"
import { agentConnections, oauthClient, paperDocs } from "../db/schema.js"
import { createPaperLog, postgresLogStore } from "../paper/log/index.js"
import { createId } from "../platform/id.js"
import {
  dataOf,
  failureOf,
  openWorld,
  type Person,
  type World,
} from "./person.test-support.js"
import { span, type Command } from "./paper-engine.test-support.js"
import { eq } from "drizzle-orm"
import { getDb } from "../db/context.js"

function seedOwnLog(docId: string) {
  return getDb()
    .update(paperDocs)
    .set({ engine: 1, snapshot: null, headVersion: 0 })
    .where(eq(paperDocs.id, docId))
}

let world: World
const scenarioEngine = createEngine({
  ids: () => createId() as BlockId,
  now: () => Date.now(),
})
const scenarioLog = createPaperLog({
  store: postgresLogStore,
  engine: scenarioEngine,
})

beforeAll(async () => {
  world = await openWorld({ coach: createDemoCoachRuntime() })
})

afterAll(async () => {
  await world.close()
})

let agents = 0

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
  await world.inside(() => seedOwnLog(docId))
  expect(await world.inside(() => scenarioLog.start(docId, doc))).toEqual({
    ok: true,
  })
  return { docId, blocks: (await engineLines(person, docId)).blocks }
}

async function personEdit(person: Person, docId: string, commands: Command[]) {
  const { version } = await engineLines(person, docId)
  return dataOf<{ revision: number }>(
    await person.run("paper.edit", { docId, basedOn: version, commands })
  )
}

async function typed(docId: string, commands: Command[]) {
  const head = (await world.inside(() => scenarioLog.head(docId))) as {
    doc: Document
    version: number
  }
  const result = scenarioEngine.run(
    scenarioEngine.load(head.doc, head.version, "tab-a"),
    commands as DocCommand[],
    { kind: "person", actor: "ada", client: "tab-a" }
  )
  if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
  expect(
    await world.inside(() => scenarioLog.append(docId, result.change))
  ).toMatchObject({ ok: true })
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

describe("Coach and outside agents only suggest", () => {
  it("changes nothing until the person accepts, then lands once with its receipt (#2247)", async () => {
    const ada = await world.person("Ada")
    const { docId, blocks } = await engineWritten(ada, ["Built dashboards"])
    const pendingActionId = await suggest(ada, docId, [
      {
        op: "replaceText",
        range: span(blocks[0]!.id, 0, 16),
        text: "Built 12 dashboards used by 40 analysts",
        expect: "Built dashboards",
      },
    ])
    expect((await engineLines(ada, docId)).texts).toEqual(["Built dashboards"])
    const accepted = dataOf<{ id: string }>(
      await ada.run("actions.approve", { pendingActionId })
    )
    expect((await engineLines(ada, docId)).texts).toEqual([
      "Built 12 dashboards used by 40 analysts",
    ])
    expect((await ada.undo(accepted.id)).status).toBe(200)
    expect((await engineLines(ada, docId)).texts).toEqual(["Built dashboards"])
  })

  it("the fake Coach proposes commands that wait for the person, land on accept and go on Undo (#2247)", async () => {
    const ada = await world.person("Ada")
    const { docId } = await engineWritten(ada, ["Built dashboards"])
    const chat = dataOf<{ id: string }>(await ada.run("chat.create", {}))
    await ada.stream(`/api/chats/${chat.id}/turns`, {
      text: "Tighten my CV",
      focusDocId: docId,
    })
    const turn = dataOf<{
      messages: { parts: { pendingActionId?: string }[] }[]
    }>(await ada.read("chat.get", { chatId: chat.id }))
    const pendingActionId = turn.messages
      .flatMap((message) => message.parts)
      .find((part) => part.pendingActionId)?.pendingActionId
    expect(pendingActionId).toBeTruthy()
    expect((await engineLines(ada, docId)).texts).toEqual(["Built dashboards"])
    const accepted = dataOf<{ id: string }>(
      await ada.run("actions.approve", { pendingActionId })
    )
    expect((await engineLines(ada, docId)).texts).toEqual([
      "Reviewed by the Coach. Built dashboards",
    ])
    expect((await ada.undo(accepted.id)).status).toBe(200)
    expect((await engineLines(ada, docId)).texts).toEqual(["Built dashboards"])
  })

  it("lists the Coach's open Suggestions on one Paper until the person accepts or rejects them (#2287)", async () => {
    const ada = await world.person("Ada")
    const { docId, blocks } = await engineWritten(ada, ["Built dashboards"])
    const other = await engineWritten(ada, ["Python"])
    const ask = async () => {
      const chat = dataOf<{ id: string }>(await ada.run("chat.create", {}))
      await ada.stream(`/api/chats/${chat.id}/turns`, {
        text: "Tighten my CV",
        focusDocId: docId,
      })
    }
    const listed = async (id: string) =>
      dataOf<{ suggestions: { id: string; commands: unknown[] }[] }>(
        await ada.read("paper.suggestions", { docId: id })
      ).suggestions
    await ask()
    const first = await listed(docId)
    expect(first.map((each) => each.commands)).toEqual([
      [
        {
          op: "replaceText",
          range: span(blocks[0]!.id, 0, 0),
          expect: "",
          text: "Reviewed by the Coach. ",
        },
      ],
    ])
    expect(await listed(other.docId)).toEqual([])
    const grace = await world.person("Grace")
    expect(
      failureOf(await grace.read("paper.suggestions", { docId })).code
    ).toBe("NOT_FOUND")
    dataOf(await ada.run("actions.approve", { pendingActionId: first[0]!.id }))
    expect(await listed(docId)).toEqual([])
    await ask()
    const second = await listed(docId)
    expect(second).toHaveLength(1)
    dataOf(await ada.run("actions.deny", { pendingActionId: second[0]!.id }))
    expect(await listed(docId)).toEqual([])
  })

  it("refuses a Suggestion whose expected text is not on the Paper (#2247)", async () => {
    const ada = await world.person("Ada")
    const { docId, blocks } = await engineWritten(ada, ["Built dashboards"])
    const agent = await connectAgent(ada)
    const { version } = await engineLines(ada, docId)
    await expect(
      world.inside(() =>
        world.registry.execute({
          name: "paper.edit",
          input: {
            docId,
            basedOn: version,
            commands: [
              {
                op: "replaceText",
                range: span(blocks[0]!.id, 0, 16),
                text: "Led a team of 30",
                expect: "Led a team of 3",
              },
            ],
          },
          actor: agent,
        })
      )
    ).rejects.toThrow(/expect-mismatch/)
  })

  it("refuses to accept a Suggestion once the person changed its text, and maps it past edits elsewhere (#2247)", async () => {
    const ada = await world.person("Ada")
    const { docId, blocks } = await engineWritten(ada, [
      "Built dashboards",
      "Python",
    ])
    const moved = await suggest(ada, docId, [
      {
        op: "replaceText",
        range: span(blocks[0]!.id, 0, 5),
        text: "Shipped",
        expect: "Built",
      },
    ])
    const elsewhere = await suggest(ada, docId, [
      {
        op: "replaceText",
        range: span(blocks[1]!.id, 0, 6),
        text: "Go",
        expect: "Python",
      },
    ])
    await personEdit(ada, docId, [
      {
        op: "replaceText",
        range: span(blocks[0]!.id, 0, 5),
        text: "Made",
        expect: "Built",
      },
    ])
    const refused = failureOf(
      await ada.run("actions.approve", { pendingActionId: moved })
    )
    expect(refused.message).toBe("The Paper changed where Coach wanted to edit")
    dataOf(await ada.run("actions.approve", { pendingActionId: elsewhere }))
    expect((await engineLines(ada, docId)).texts).toEqual([
      "Made dashboards",
      "Go",
    ])
  })

  it("takes back an accepted Suggestion after later edits elsewhere, and refuses once its text changed (#2247)", async () => {
    const ada = await world.person("Ada")
    const { docId, blocks } = await engineWritten(ada, [
      "Built dashboards",
      "Python",
    ])
    const pendingActionId = await suggest(ada, docId, [
      {
        op: "replaceText",
        range: span(blocks[0]!.id, 0, 5),
        text: "Shipped",
        expect: "Built",
      },
    ])
    const accepted = dataOf<{ id: string }>(
      await ada.run("actions.approve", { pendingActionId })
    )
    await typed(docId, [
      { op: "insertText", range: span(blocks[1]!.id, 6, 6), text: ", SQL" },
    ])
    expect((await ada.undo(accepted.id)).status).toBe(200)
    expect((await engineLines(ada, docId)).texts).toEqual([
      "Built dashboards",
      "Python, SQL",
    ])

    const again = await suggest(ada, docId, [
      {
        op: "replaceText",
        range: span(blocks[1]!.id, 0, 6),
        text: "Go",
        expect: "Python",
      },
    ])
    const second = dataOf<{ id: string }>(
      await ada.run("actions.approve", { pendingActionId: again })
    )
    await typed(docId, [
      { op: "deleteRange", range: span(blocks[1]!.id, 0, 2) },
    ])
    const refused = failureOf(await ada.undo(second.id))
    expect(refused.message).toBe("The Paper changed there since")
  })
})
