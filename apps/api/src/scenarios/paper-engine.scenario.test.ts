import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createId } from "../platform/id.js"
import {
  dataOf,
  failureOf,
  openWorld,
  type World,
} from "./person.test-support.js"
import {
  engineHelpers,
  at,
  span,
  texts,
  pdfPages,
} from "./paper-engine.test-support.js"

let world: World
let paper: ReturnType<typeof engineHelpers>

beforeAll(async () => {
  world = await openWorld()
  paper = engineHelpers(world)
})

afterAll(async () => {
  await world.close()
})

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

  it.fails(
    "stores the steps a tab sent, so every replay gives the same Paper (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const docId = await paper.blank(ada)
      const first = (await paper.outline(ada, docId)).blocks[0]!
      const change = {
        edit: createId(),
        origin: { kind: "person", actor: ada.id, client: "tab-a" },
        base: 0,
        steps: [
          {
            stepType: "replace",
            from: 1,
            to: 1,
            slice: { content: [{ type: "text", text: "Hello" }] },
          },
        ],
        commands: [
          { op: "insertText", range: span(first.id, 0, 0), text: "Hello" },
        ],
      }
      dataOf(
        await ada.run("paper.save", {
          docId,
          client: "tab-a",
          base: 0,
          changes: [change],
        })
      )
      const stored = dataOf<{ steps: unknown[] }[]>(
        await ada.read("paper.changes", { docId, since: 0 })
      )
      expect(stored.map((saved) => saved.steps)).toEqual([change.steps])
      expect(texts(await paper.outline(ada, docId))).toEqual(["Hello"])
    }
  )

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

  it.fails(
    "refuses a change that would break the Paper's shape, and stores nothing (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const docId = await paper.blank(ada)
      const first = (await paper.outline(ada, docId)).blocks[0]!
      const hostile = {
        edit: createId(),
        origin: { kind: "person", actor: ada.id, client: "tab-a" },
        base: 0,
        steps: [
          {
            stepType: "replace",
            from: 0,
            to: 0,
            slice: {
              content: [
                {
                  type: "text_block",
                  attrs: { id: first.id, kind: "banner", list: null, level: 3 },
                },
              ],
            },
          },
        ],
        commands: [
          { op: "insertBlock", at: at(first.id, 0), block: "divider" },
        ],
      }
      const refused = failureOf(
        await ada.run("paper.save", {
          docId,
          client: "tab-a",
          base: 0,
          changes: [hostile],
        })
      )
      expect(refused.code).toBe("schema")
      expect(await paper.outline(ada, docId)).toMatchObject({
        version: 0,
        blocks: [{ id: first.id, text: "" }],
      })
    }
  )
})

describe("Coach and outside agents only suggest", () => {
  it.fails(
    "changes nothing until the person accepts, then lands once with its receipt (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const { docId, blocks } = await paper.written(ada, ["Built dashboards"])
      const pendingActionId = await paper.suggest(ada, docId, [
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
      const agent = await paper.connectAgent(ada)
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
      const pendingActionId = await paper.suggest(ada, docId, [
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

      const again = await paper.suggest(ada, docId, [
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
  it.fails(
    "refuses another person's change and a change whose steps do not match its commands (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const grace = await world.person("Grace")
      const docId = await paper.blank(ada)
      const first = (await paper.outline(ada, docId)).blocks[0]!
      const change = (text: string, typed: string) => ({
        edit: createId(),
        origin: { kind: "person", actor: ada.id, client: "tab-a" },
        base: 0,
        steps: [
          {
            stepType: "replace",
            from: 1,
            to: 1,
            slice: { content: [{ type: "text", text }] },
          },
        ],
        commands: [
          { op: "insertText", range: span(first.id, 0, 0), text: typed },
        ],
      })
      expect(
        failureOf(
          await grace.run("paper.save", {
            docId,
            client: "tab-g",
            base: 0,
            changes: [change("Hi", "Hi")],
          })
        ).code
      ).toBe("not_found")
      expect(
        failureOf(
          await ada.run("paper.save", {
            docId,
            client: "tab-a",
            base: 0,
            changes: [change("Hx", "Hi")],
          })
        ).code
      ).toBe("schema")
      dataOf(
        await ada.run("paper.save", {
          docId,
          client: "tab-a",
          base: 0,
          changes: [change("Hi", "Hi")],
        })
      )
      expect(texts(await paper.outline(ada, docId))).toEqual(["Hi"])
    }
  )

  it.fails(
    "answers a push on an old version with the changes since, and stores nothing (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const { docId, blocks } = await paper.written(ada, ["Analyst"])
      const head = (await paper.outline(ada, docId)).version
      const late = {
        edit: createId(),
        origin: { kind: "person", actor: ada.id, client: "tab-b" },
        base: 0,
        steps: [
          {
            stepType: "replace",
            from: 1,
            to: 1,
            slice: { content: [{ type: "text", text: "Data " }] },
          },
        ],
        commands: [
          { op: "insertText", range: span(blocks[0]!.id, 0, 0), text: "Data " },
        ],
      }
      const reply = dataOf<{ stale: boolean; since: unknown[] }>(
        await ada.run("paper.save", {
          docId,
          client: "tab-b",
          base: 0,
          changes: [late],
        })
      )
      expect(reply.stale).toBe(true)
      expect(reply.since).toHaveLength(head)
      expect(await paper.outline(ada, docId)).toMatchObject({
        version: head,
        blocks: [{ text: "Analyst" }],
      })
    }
  )
})
