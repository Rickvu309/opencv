import fc from "fast-check"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { paperDocs } from "../db/schema.js"
import { openCoachStore, type CoachStore } from "../test/paper-coach.js"

const userId = "user-coach-property"

type Node = Record<string, unknown> & { id: string; children?: Node[] }
type Doc = { blocks: Node[] }

let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterAll(async () => {
  await h.store.client.close()
})

const stepArbitrary = fc.record({
  kind: fc.constantFrom(
    "type",
    "type",
    "erase",
    "swap",
    "retype",
    "addBlock",
    "setText",
    "setText",
    "insert",
    "insertInto",
    "move",
    "remove",
    "setFields",
    "undo",
    "undo"
  ),
  a: fc.nat(1000),
  b: fc.nat(1000),
  c: fc.nat(1000),
})

type Step = typeof stepArbitrary extends fc.Arbitrary<infer T> ? T : never

const bullet = (id: string, text: string, children: Node[] = []): Node => ({
  id,
  type: "bullet",
  content: [{ text }],
  children,
})

const setup: Node[] = [
  {
    id: "e1",
    type: "experience",
    role: "Analyst",
    company: "Babbage",
    period: "1842",
    location: "",
    children: [
      bullet("b1", "Bullet one", [bullet("b1a", "Nested")]),
      bullet("b2", "Bullet two"),
    ],
  },
  { id: "t3", type: "paragraph", content: [{ text: "Third paragraph." }] },
]

function flatten(nodes: Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])])
}

function mapNode(nodes: Node[], id: string, change: (n: Node) => Node): Node[] {
  return nodes.map((node) =>
    node.id === id
      ? change(node)
      : node.children
        ? { ...node, children: mapNode(node.children, id, change) }
        : node
  )
}

const textOf = (node: Node) =>
  Array.isArray(node.content)
    ? (node.content as { text: string }[]).map((run) => run.text).join("")
    : ""

const withContent = (node: Node, text: string): Node => ({
  ...node,
  content: text ? [{ text }] : [],
})

const textBlocks = (doc: Doc) =>
  flatten(doc.blocks).filter((node) => Array.isArray(node.content))

const tokens = (doc: Doc, pattern: RegExp) =>
  new Set(JSON.stringify(doc).match(pattern) ?? [])

const PERSON = /⟦p\d+⟧/g
const COACH = /⟨c\d+⟩/g

function inserted(text: string, at: number, token: string) {
  let cut = at % (text.length + 1)
  for (const match of text.matchAll(/[⟦⟨][pc]\d+[⟧⟩]/g)) {
    const start = match.index
    if (cut > start && cut < start + match[0].length)
      cut = start + match[0].length
  }
  return `${text.slice(0, cut)}${token}${text.slice(cut)}`
}

function pick<T>(items: readonly T[], index: number): T | undefined {
  return items.length === 0 ? undefined : items[index % items.length]
}

async function snapshot(docId: string) {
  const row = (
    await h.store.db.select().from(paperDocs).where(eq(paperDocs.id, docId))
  )[0]!
  return {
    revision: row.contentVersion,
    doc: row.crdtDocument as unknown as Doc,
  }
}

describe("random person and Coach edits over blocks, lists and an experience", () => {
  it("never lose what the person typed, and undo only takes back the Coach's", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(stepArbitrary, { minLength: 4, maxLength: 8 }),
        async (steps: Step[]) => {
          await h.inDatabase(async () => {
            const { docId, client } = await h.created()
            await h.person(
              docId,
              client,
              (paper) =>
                ({
                  ...paper,
                  blocks: [...paper.blocks, ...setup],
                }) as never
            )
            const seen = new Map<number, Doc>()
            const first = await snapshot(docId)
            seen.set(first.revision, first.doc)
            const undoable: { activityId: string; tokens: string[] }[] = []
            let counter = 0

            const personEdit = (change: (doc: Doc) => Doc) =>
              h.person(docId, client, ((paper: Doc) => ({
                ...paper,
                ...change(paper),
              })) as never)

            for (const step of steps) {
              const { doc: live, revision } = await snapshot(docId)
              const blocks = live.blocks
              if (step.kind === "type") {
                const target = pick(textBlocks(live), step.a)
                if (target) {
                  const token = `⟦p${++counter}⟧`
                  await personEdit((doc) => ({
                    blocks: mapNode(doc.blocks, target.id, (node) =>
                      withContent(node, inserted(textOf(node), step.b, token))
                    ),
                  }))
                }
              } else if (step.kind === "erase") {
                const holders = textBlocks(live).filter((node) =>
                  /⟦p\d+⟧/.test(textOf(node))
                )
                const target = pick(holders, step.a)
                if (target) {
                  await personEdit((doc) => ({
                    blocks: mapNode(doc.blocks, target.id, (node) =>
                      withContent(node, textOf(node).replace(/⟦p\d+⟧/, ""))
                    ),
                  }))
                }
              } else if (step.kind === "swap") {
                const at = step.a % Math.max(1, blocks.length - 1)
                await personEdit((doc) => {
                  const next = [...doc.blocks]
                  const [moved] = next.splice(at, 1)
                  if (moved) next.splice(at + 1, 0, moved)
                  return { blocks: next }
                })
              } else if (step.kind === "retype") {
                const target = pick(
                  blocks.filter((node) => node.type === "paragraph"),
                  step.a
                )
                if (target) {
                  await personEdit((doc) => ({
                    blocks: doc.blocks.map((node) =>
                      node.id === target.id
                        ? { ...node, type: "heading", level: 2 }
                        : node
                    ),
                  }))
                }
              } else if (step.kind === "addBlock") {
                const token = `⟦p${++counter}⟧`
                await personEdit((doc) => {
                  const next = [...doc.blocks]
                  next.splice(step.a % (next.length + 1), 0, {
                    id: `pb${counter}`,
                    type: "paragraph",
                    content: [{ text: `Mine ${token}` }],
                  })
                  return { blocks: next }
                })
              } else if (step.kind === "undo") {
                const entry = pick(undoable, step.a)
                if (!entry) continue
                const before = tokens(live, PERSON)
                const rows = revision
                try {
                  await h.store.registry.undo(userId, entry.activityId)
                } catch (error) {
                  expect((error as { code?: string }).code).toBe("CONFLICT")
                  expect((await snapshot(docId)).revision).toBe(rows)
                  continue
                }
                const after = await snapshot(docId)
                for (const token of before) {
                  expect(tokens(after.doc, PERSON).has(token)).toBe(true)
                }
                for (const token of entry.tokens) {
                  expect(tokens(after.doc, COACH).has(token)).toBe(false)
                }
                undoable.splice(undoable.indexOf(entry), 1)
              } else {
                const known = [...seen.keys()]
                const basedOn = pick(known, step.a)!
                const base = seen.get(basedOn)!
                const token = `⟨c${++counter}⟩`
                const baseNodes = flatten(base.blocks)
                const topIds = base.blocks.map((node) => node.id)
                let edit: Record<string, unknown> | null = null
                if (step.kind === "setText") {
                  const target = pick(textBlocks(base), step.b)
                  if (target) {
                    edit = {
                      op: "setText",
                      blockId: target.id,
                      text: inserted(textOf(target), step.c, token),
                    }
                  }
                } else if (step.kind === "insert") {
                  edit = {
                    op: "insert",
                    after: pick(baseNodes, step.b)?.id,
                    blocks: [{ type: "paragraph", text: `New ${token}` }],
                  }
                  if (!edit.after) edit = null
                } else if (step.kind === "insertInto") {
                  edit = {
                    op: "insertInto",
                    into: pick(["e1", "b1", "b2"], step.b),
                    blocks: [{ type: "bullet", text: `Item ${token}` }],
                  }
                } else if (step.kind === "move") {
                  const moved = pick(topIds.slice(1), step.b)
                  const after = pick(["@start", ...topIds], step.c)
                  if (moved && after)
                    edit = { op: "move", blockId: moved, after }
                } else if (step.kind === "remove") {
                  const gone = pick(
                    baseNodes.filter((node) => node.id !== "s1"),
                    step.b
                  )
                  if (gone) edit = { op: "remove", blockId: gone.id }
                } else if (step.kind === "setFields") {
                  edit = {
                    op: "setFields",
                    blockId: "e1",
                    fields: { role: `Role ${token}` },
                  }
                }
                if (!edit) continue
                const beforePerson = tokens(live, PERSON)
                const basePerson = tokens(base, PERSON)
                const result = await h.coach(docId, basedOn, [edit])
                const after = await snapshot(docId)
                for (const kept of beforePerson) {
                  const mayGo = basePerson.has(kept) && edit.op === "remove"
                  if (!mayGo) {
                    expect(tokens(after.doc, PERSON).has(kept)).toBe(true)
                  }
                }
                if (result.output.editId && result.activityId) {
                  undoable.push({
                    activityId: result.activityId,
                    tokens: [token],
                  })
                }
              }
              const now = await snapshot(docId)
              seen.set(now.revision, now.doc)
            }
          })
        }
      ),
      { numRuns: 4, seed: 20261103 }
    )
  })
})
