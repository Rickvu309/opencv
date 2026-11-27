import { delegateActorSchema } from "@workspace/domain/kernel"
import { paperEngineBlank, type LayoutPage } from "@workspace/domain/paper-doc"
import {
  createEngine,
  createLayouter,
  fixedClock,
  paperFontMetrics,
  seededIds,
} from "@workspace/paper-engine"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { agentConnections, oauthClient } from "../db/schema.js"
import { engineLog } from "../paper/engine-sync-log.js"
import { createPaperLog, postgresLogStore } from "../paper/log/index.js"
import { createId } from "../platform/id.js"
import {
  dataOf,
  failureOf,
  openWorld,
  type Person,
  type World,
} from "./person.test-support.js"
import {
  engineHelpers,
  at,
  span,
  texts,
  type Command,
} from "./paper-engine.test-support.js"

let world: World
let paper: ReturnType<typeof engineHelpers>

beforeAll(async () => {
  world = await openWorld()
  paper = engineHelpers()
})

afterAll(async () => {
  await world.close()
})

async function pdfPages(bytes: Buffer) {
  const unpdf = await import("unpdf")
  const pdf = await unpdf.getDocumentProxy(new Uint8Array(bytes))
  const { text } = await unpdf.extractText(pdf, { mergePages: false })
  return text
}

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

async function suggest(person: Person, docId: string, commands: Command[]) {
  const agent = await connectAgent(person)
  const { version } = await paper.outline(person, docId)
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

const editor = createEngine({
  ids: seededIds("scenario-edit"),
  now: fixedClock(),
})
const log = createPaperLog({ store: postgresLogStore, engine: editor })
const blank = paperEngineBlank.blankCv()

async function enginePaper(owner: Person) {
  const id = await paper.blank(owner)
  expect(await world.inside(() => log.start(id, blank))).toEqual({ ok: true })
  return id
}

function type(
  owner: Person,
  client: string,
  text: string,
  base = 0,
  offset = 0,
  doc = blank
) {
  const pos = { block: doc.content[0]!.attrs.id, offset }
  const result = editor.run(
    editor.load(doc, base, client),
    [{ op: "insertText", range: { from: pos, to: pos }, text }],
    { kind: "person", actor: owner.id, client }
  )
  if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
  return result.change
}

async function stored(docId: string) {
  const saved = await world.inside(() => log.head(docId))
  if (!("doc" in saved)) throw new Error(JSON.stringify(saved))
  return saved
}

describe("the Paper engine keeps its promises", () => {
  it.fails(
    "loses no text outside the range a command changes (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const { docId, blocks } = await paper.written(ada, [
        "Ada Lovelace",
        "Analyst",
        "Python",
      ])
      await paper.edit(ada, docId, [
        { op: "deleteRange", range: span(blocks[1]!.id, 0, 3) },
      ])
      expect(texts(await paper.outline(ada, docId))).toEqual([
        "Ada Lovelace",
        "lyst",
        "Python",
      ])
    }
  )

  it.fails(
    "undoes a change exactly, back to the Paper before it (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const { docId, blocks } = await paper.written(ada, [
        "Ada Lovelace",
        "Analyst",
      ])
      const before = await paper.outline(ada, docId)
      const done = await paper.edit(ada, docId, [
        { op: "setBlockKind", blocks: [blocks[0]!.id], kind: "title" },
        {
          op: "insertText",
          range: span(blocks[1]!.id, 0, 7),
          text: "Engineer",
        },
        { op: "splitBlock", at: at(blocks[1]!.id, 3) },
      ])
      expect((await ada.undo(done.activityId)).status).toBe(200)
      expect((await paper.outline(ada, docId)).blocks).toEqual(before.blocks)
    }
  )

  it("stores the steps a tab sent, so every replay gives the same Paper", async () => {
    const ada = await world.person("Ada")
    const docId = await enginePaper(ada)
    const tab = "tab-a"
    const origin = { kind: "person", actor: ada.id, client: tab } as const
    const block = blank.content[0]!.attrs.id
    const start = { block, offset: 0 }
    const first = editor.run(
      editor.load(blank, 0, tab),
      [
        {
          op: "insertText",
          range: { from: start, to: start },
          text: "Hello world",
        },
      ],
      origin
    )
    if ("refusal" in first) throw new Error(JSON.stringify(first.refusal))
    const split = editor.run(
      editor.load(editor.read(first.state).doc, first.change.steps.length, tab),
      [{ op: "splitBlock", at: { block, offset: 6 } }],
      origin
    )
    if ("refusal" in split) throw new Error(JSON.stringify(split.refusal))
    const changes = [first.change, split.change]
    const head = changes.flatMap((change) => change.steps).length
    const saved = await ada.run("paper.save", {
      docId,
      client: tab,
      base: 0,
      changes,
    })
    expect(saved.status).toBe(200)
    expect(dataOf(saved)).toEqual({ ok: true, head })
    expect(
      dataOf(await ada.read("paper.changes", { docId, since: 0 }))
    ).toEqual({
      head,
      changes,
    })
    expect(await stored(docId)).toEqual({
      version: head,
      doc: editor.read(split.state).doc,
    })
  })

  it.fails(
    "puts the same lines on the same pages on screen and in the PDF (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const lines = Array.from(
        { length: 90 },
        (_, n) => `Line ${n + 1} of a long CV`
      )
      const { docId } = await paper.written(ada, lines)
      const laid = await paper.layout(ada, docId)
      const pdf = await paper.exported(ada, docId, "pdf")
      const pages = await pdfPages(pdf.bytes)
      expect(laid.pages.length).toBeGreaterThan(1)
      expect(pages).toHaveLength(laid.pages.length)
      laid.pages.forEach((page, index) => {
        expect(pages[index]).toContain(page.lines[0]!.text)
        expect(pages[index]).toContain(page.lines.at(-1)!.text)
      })
    }
  )

  it.fails("lays out only the Block a keystroke changed (#2207)", async () => {
    const ada = await world.person("Ada")
    const { docId, blocks } = await paper.written(ada, [
      "Ada Lovelace",
      "Analyst",
      "Python",
    ])
    const before = await paper.layout(ada, docId)
    await paper.edit(ada, docId, [
      { op: "insertText", range: span(blocks[1]!.id, 7, 7), text: "s" },
    ])
    const after = await paper.layout(ada, docId, before.version)
    expect(after.work.blocksLaidOut).toBe(1)
  })

  it.each([
    [
      "a step with an unknown node",
      [
        {
          stepType: "replace",
          from: 0,
          to: 0,
          slice: { content: [{ type: "unknown" }] },
        },
      ],
      "Unknown node type: unknown",
    ],
    [
      "a duplicate block id",
      [
        {
          stepType: "replace",
          from: 0,
          to: 0,
          slice: { content: blank.content },
        },
      ],
      "Block ids must be unique",
    ],
  ])("rolls back a batch containing %s", async (_label, steps, message) => {
    const ada = await world.person("Ada")
    const docId = await enginePaper(ada)
    const first = type(ada, "tab-a", "Hello")
    const hostile = {
      ...type(ada, "tab-a", "Hi", 1),
      steps,
    }
    const result = failureOf(
      await ada.run("paper.save", {
        docId,
        client: "tab-a",
        base: 0,
        changes: [first, hostile],
      })
    )
    expect(result.code).toBe("schema")
    expect(result.message).toContain(message)
    expect(await stored(docId)).toEqual({ doc: blank, version: 0 })
    expect(
      dataOf(await ada.read("paper.changes", { docId, since: 0 }))
    ).toEqual({ head: 0, changes: [] })
  })
})

describe("Coach and outside agents only suggest", () => {
  it.fails(
    "changes nothing until the person accepts, then lands once with its receipt (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const { docId, blocks } = await paper.written(ada, ["Built dashboards"])
      const pendingActionId = await suggest(ada, docId, [
        {
          op: "insertText",
          range: span(blocks[0]!.id, 0, 16),
          text: "Built 12 dashboards used by 40 analysts",
          expect: "Built dashboards",
        },
      ])
      expect(texts(await paper.outline(ada, docId))).toEqual([
        "Built dashboards",
      ])
      const accepted = dataOf<{ activityId: string }>(
        await ada.run("actions.approve", { pendingActionId })
      )
      expect(texts(await paper.outline(ada, docId))).toEqual([
        "Built 12 dashboards used by 40 analysts",
      ])
      expect((await ada.undo(accepted.activityId)).status).toBe(200)
      expect(texts(await paper.outline(ada, docId))).toEqual([
        "Built dashboards",
      ])
    }
  )

  it.fails(
    "refuses a Suggestion whose expected text is not on the Paper (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const { docId, blocks } = await paper.written(ada, ["Built dashboards"])
      const agent = await connectAgent(ada)
      const { version } = await paper.outline(ada, docId)
      await expect(
        world.inside(() =>
          world.registry.execute({
            name: "paper.edit",
            input: {
              docId,
              basedOn: version,
              commands: [
                {
                  op: "insertText",
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
    }
  )

  it.fails(
    "takes back an accepted Suggestion after later edits elsewhere, and refuses once its text changed (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const { docId, blocks } = await paper.written(ada, [
        "Built dashboards",
        "Python",
      ])
      const pendingActionId = await suggest(ada, docId, [
        {
          op: "insertText",
          range: span(blocks[0]!.id, 0, 5),
          text: "Shipped",
          expect: "Built",
        },
      ])
      const accepted = dataOf<{ activityId: string }>(
        await ada.run("actions.approve", { pendingActionId })
      )
      await paper.edit(ada, docId, [
        { op: "insertText", range: span(blocks[1]!.id, 6, 6), text: ", SQL" },
      ])
      expect((await ada.undo(accepted.activityId)).status).toBe(200)
      expect(texts(await paper.outline(ada, docId))).toEqual([
        "Built dashboards",
        "Python, SQL",
      ])

      const again = await suggest(ada, docId, [
        {
          op: "insertText",
          range: span(blocks[1]!.id, 0, 6),
          text: "Go",
          expect: "Python",
        },
      ])
      const second = dataOf<{ activityId: string }>(
        await ada.run("actions.approve", { pendingActionId: again })
      )
      await paper.edit(ada, docId, [
        { op: "deleteRange", range: span(blocks[1]!.id, 0, 2) },
      ])
      const refused = failureOf(await ada.undo(second.activityId))
      expect(refused.message).toBe("The Paper changed there since")
    }
  )
})

describe("only the owner's tabs write, in server order", () => {
  it("refuses access from another account and changes with a Coach origin", async () => {
    const ada = await world.person("Ada")
    const grace = await world.person("Grace")
    const docId = await enginePaper(ada)
    const change = type(ada, "tab-a", "Hi")
    const save = (person: Person, changes: unknown[]) =>
      person.run("paper.save", {
        docId,
        client: "tab-a",
        base: 0,
        changes,
      })
    expect(failureOf(await save(grace, [change])).code).toBe("NOT_FOUND")
    expect(
      failureOf(await grace.read("paper.changes", { docId, since: 0 })).code
    ).toBe("NOT_FOUND")
    expect(
      failureOf(
        await ada.read("paper.changes", {
          docId: await paper.blank(ada),
          since: 0,
        })
      ).code
    ).toBe("NOT_FOUND")
    expect(
      failureOf(
        await save(ada, [
          {
            ...change,
            origin: { ...change.origin, kind: "coach" },
          },
        ])
      ).code
    ).toBe("schema")
    expect(await stored(docId)).toEqual({ doc: blank, version: 0 })
    expect(dataOf(await save(ada, [change]))).toEqual({ ok: true, head: 1 })
  })

  it("answers a push on an old version with the changes since and stores nothing", async () => {
    const ada = await world.person("Ada")
    const docId = await enginePaper(ada)
    const first = type(ada, "tab-a", "Analyst")
    dataOf(
      await ada.run("paper.save", {
        docId,
        client: "tab-a",
        base: 0,
        changes: [first],
      })
    )
    expect(
      dataOf(
        await ada.run("paper.save", {
          docId,
          client: "tab-b",
          base: 0,
          changes: [type(ada, "tab-b", "Data ")],
        })
      )
    ).toEqual({ stale: true, head: 1, since: [first] })
    expect(await stored(docId)).toMatchObject({
      version: 1,
      doc: { content: [{ content: [{ text: "Analyst" }] }] },
    })
  })

  it("accepts mapped steps after a stale reply and saves a resend once", async () => {
    const ada = await world.person("Ada")
    const docId = await enginePaper(ada)
    const initial = type(ada, "tab-a", "Analyst")
    const save = (change: typeof initial) =>
      ada.run("paper.save", {
        docId,
        client: change.origin.client,
        base: change.base,
        changes: [change],
      })
    expect(dataOf(await save(initial))).toEqual({ ok: true, head: 1 })
    const { doc } = await stored(docId)
    const first = type(ada, "tab-a", "Data ", 1, 0, doc)
    const second = type(ada, "tab-b", " today", 1, 7, doc)
    expect(dataOf(await save(first))).toEqual({ ok: true, head: 2 })
    expect(dataOf(await save(second))).toEqual({
      stale: true,
      head: 2,
      since: [first],
    })
    const state = editor.load(doc, 1, second.origin.client, [second])
    const { state: rebased } = editor.receive(state, [first])
    const [rebasedChange] = editor.sendable(rebased)
    expect(rebasedChange?.steps).not.toEqual(second.steps)
    expect(rebasedChange?.commands).toEqual(second.commands)
    expect(dataOf(await save(rebasedChange!))).toEqual({ ok: true, head: 3 })
    expect(dataOf(await save(first))).toEqual({ ok: true, head: 3 })
    expect(dataOf(await save(rebasedChange!))).toEqual({ ok: true, head: 3 })
    expect(await stored(docId)).toMatchObject({
      version: 3,
      doc: { content: [{ content: [{ text: "Data Analyst today" }] }] },
    })
  })

  it("saves a tab's Undo with no commands", async () => {
    const ada = await world.person("Ada")
    const docId = await enginePaper(ada)
    const client = "tab-a"
    const origin = { kind: "person", actor: ada.id, client } as const
    const pos = { block: blank.content[0]!.attrs.id, offset: 0 }
    const edit = editor.run(
      editor.load(blank, 0, client),
      [{ op: "insertText", range: { from: pos, to: pos }, text: "Draft" }],
      origin
    )
    if ("refusal" in edit) throw new Error(JSON.stringify(edit.refusal))
    const save = (change: typeof edit.change) =>
      ada.run("paper.save", {
        docId,
        client,
        base: change.base,
        changes: [change],
      })

    expect(dataOf(await save(edit.change))).toEqual({ ok: true, head: 1 })
    const confirmed = editor.receive(edit.state, [edit.change]).state
    const undone = editor.undo(confirmed)
    if (!undone || "refusal" in undone)
      throw new Error("Expected an Undo change")
    expect(undone.change.commands).toEqual([])
    expect(dataOf(await save(undone.change))).toEqual({ ok: true, head: 2 })
    expect(await stored(docId)).toEqual({ doc: blank, version: 2 })
    expect(
      dataOf(await ada.read("paper.changes", { docId, since: 1 }))
    ).toEqual({ head: 2, changes: [undone.change] })
  })

  it("a saved Paper's library card carries its real first page (#2248)", async () => {
    const ada = await world.person("Ada")
    const docId = await enginePaper(ada)
    const change = type(ada, "tab-a", "Ada Lovelace, engineer")
    expect(
      dataOf(
        await ada.run("paper.save", {
          docId,
          client: "tab-a",
          base: 0,
          changes: [change],
        })
      )
    ).toEqual({ ok: true, head: 1 })
    await world.inside(() => engineLog.flushFirstPage(docId))
    const listed = dataOf<{ id: string; firstPage?: LayoutPage }[]>(
      await ada.read("paper.list", {})
    )
    const { doc } = await stored(docId)
    const expected = createLayouter(paperFontMetrics).layout(doc, null)
      .pages[0]!
    expect(listed.find((row) => row.id === docId)?.firstPage).toEqual(
      JSON.parse(JSON.stringify(expected)) as LayoutPage
    )
  })
})
