import fc from "fast-check"
import { materialize, stateVectorOf, updateSince } from "@workspace/paper-crdt"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { paperDocs } from "../db/schema.js"
import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { bytesOf, encoded, typed } from "../test/paper-content.js"

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
    "staleType",
    "staleDiff",
    "applyFirst",
    "bold",
    "editCoach",
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

const personText = (doc: Doc) =>
  textBlocks(doc)
    .map((node) => textOf(node))
    .join("\n")

function charCounts(doc: Doc): Map<string, number> {
  const counts = new Map<string, number>()
  for (const char of personText(doc))
    counts.set(char, (counts.get(char) ?? 0) + 1)
  return counts
}

function within(small: Map<string, number>, big: Map<string, number>[]) {
  for (const [char, count] of small) {
    const room = big.reduce((total, map) => total + (map.get(char) ?? 0), 0)
    if (count > room) return false
  }
  return true
}

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
            const undoable: {
              activityId: string
              tokens: string[]
              preCoach: Doc
              revision: number
            }[] = []
            let counter = 0
            const typedEver = new Set<string>()
            const erased = new Set<string>()

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
                  const token = step.c % 3 === 0 ? "e" : `⟦p${++counter}⟧`
                  typedEver.add(token)
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
                  const gone = textOf(target).match(/⟦p\d+⟧/)?.[0]
                  if (gone) erased.add(gone)
                  await personEdit((doc) => ({
                    blocks: mapNode(doc.blocks, target.id, (node) =>
                      withContent(node, textOf(node).replace(/⟦p\d+⟧/, ""))
                    ),
                  }))
                }
              } else if (step.kind === "swap") {
                const at = step.a % Math.max(1, blocks.length - 1)
                const next = blocks[at + 1]
                if (
                  at === 0 &&
                  next &&
                  ["experience", "education", "skills"].includes(
                    String(next.type)
                  )
                ) {
                  continue
                }
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
                typedEver.add(token)
                await personEdit((doc) => {
                  const next = [...doc.blocks]
                  next.splice(step.a % (next.length + 1), 0, {
                    id: `pb${counter}`,
                    type: "paragraph",
                    content: [{ text: `Mine ${token}` }],
                  })
                  return { blocks: next }
                })
              } else if (step.kind === "bold") {
                const target = pick(textBlocks(live), step.a)
                if (target && textOf(target).length >= 2) {
                  const text = textOf(target)
                  const cut = Math.max(1, step.b % text.length)
                  await personEdit((doc) => ({
                    blocks: mapNode(doc.blocks, target.id, (node) => ({
                      ...node,
                      content: [
                        { text: text.slice(0, cut) },
                        { text: text.slice(cut), bold: true },
                      ],
                    })),
                  }))
                }
              } else if (step.kind === "editCoach") {
                const holder = pick(
                  textBlocks(live).filter((node) =>
                    /⟨c\d+⟩/.test(textOf(node))
                  ),
                  step.a
                )
                if (holder) {
                  await personEdit((doc) => ({
                    blocks: mapNode(doc.blocks, holder.id, (node) =>
                      withContent(node, textOf(node).replace(/⟨c/, "⟨cx"))
                    ),
                  }))
                }
              } else if (step.kind === "staleType") {
                const local = materialize(client)
                const view = local.ok
                  ? (local.document as unknown as Doc)
                  : null
                const target = view ? pick(textBlocks(view), step.a) : undefined
                if (view && target) {
                  const token = `⟦p${++counter}⟧`
                  typedEver.add(token)
                  await h.run("paper.sync", {
                    docId,
                    epoch: 1,
                    update: typed(client, ((paper: Doc) => ({
                      ...paper,
                      blocks: mapNode(paper.blocks, target.id, (node) =>
                        withContent(node, inserted(textOf(node), step.b, token))
                      ),
                    })) as never),
                    stateVector:
                      step.c % 2 === 0 ? encoded(stateVectorOf(client)) : "",
                  })
                }
              } else if (
                step.kind === "staleDiff" ||
                step.kind === "applyFirst"
              ) {
                const local = materialize(client)
                const view = local.ok
                  ? (local.document as unknown as Doc)
                  : null
                const target = view ? pick(textBlocks(view), step.a) : undefined
                if (view && target) {
                  const since = stateVectorOf(client)
                  const first = `⟦p${++counter}⟧`
                  const second = `⟦p${++counter}⟧`
                  const edit = (token: string) => (paper: Doc) => ({
                    ...paper,
                    blocks: mapNode(paper.blocks, target.id, (node) =>
                      withContent(node, inserted(textOf(node), step.b, token))
                    ),
                  })
                  let update: Uint8Array
                  if (step.kind === "staleDiff") {
                    typed(client, edit(first) as never)
                    typed(client, ((paper: Doc) => ({
                      ...paper,
                      blocks: mapNode(paper.blocks, target.id, (node) =>
                        withContent(node, textOf(node).replace(first, ""))
                      ),
                    })) as never)
                    typed(client, edit(second) as never)
                    typedEver.add(first)
                    erased.add(first)
                    typedEver.add(second)
                    update = updateSince(client, since)!
                  } else {
                    update = bytesOf(typed(client, edit(second) as never))
                    typedEver.add(second)
                    await h.pull(docId, client)
                  }
                  await h.run("paper.sync", {
                    docId,
                    epoch: 1,
                    update: encoded(update),
                    stateVector:
                      step.c % 2 === 0 ? encoded(stateVectorOf(client)) : "",
                  })
                  if (step.kind === "applyFirst") {
                    const present = JSON.stringify((await snapshot(docId)).doc)
                    expect(
                      present.split(second).length - 1
                    ).toBeLessThanOrEqual(1)
                  }
                }
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
                expect(
                  within(charCounts(after.doc), [
                    charCounts(live),
                    charCounts(entry.preCoach),
                  ])
                ).toBe(true)
                if (revision === entry.revision) {
                  expect(JSON.stringify(after.doc.blocks)).toBe(
                    JSON.stringify(entry.preCoach.blocks)
                  )
                }
                undoable.splice(undoable.indexOf(entry), 1)
              } else {
                const known = [...seen.keys()]
                const basedOn = pick(known, step.a)!
                const base = seen.get(basedOn)!
                const coachToken = `⟨c${++counter}⟩`
                const token = step.c % 3 === 0 ? "e" : coachToken
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
                if (edit.op !== "remove") {
                  expect(
                    within(charCounts(live), [charCounts(after.doc)])
                  ).toBe(true)
                }
                for (const kept of beforePerson) {
                  const mayGo = basePerson.has(kept) && edit.op === "remove"
                  if (!mayGo) {
                    expect(tokens(after.doc, PERSON).has(kept)).toBe(true)
                  }
                }
                if (result.output.editId && result.activityId) {
                  undoable.push({
                    activityId: result.activityId,
                    tokens: token === coachToken ? [coachToken] : [],
                    preCoach: live,
                    revision: result.output.revision,
                  })
                }
              }
              const now = await snapshot(docId)
              seen.set(now.revision, now.doc)
              const found = JSON.stringify(now.doc).match(PERSON) ?? []
              expect(new Set(found).size).toBe(found.length)
              for (const token of found) {
                expect(typedEver.has(token) || /⟦p\d+⟧/.test(token)).toBe(true)
                expect(erased.has(token)).toBe(false)
              }
            }
          })
        }
      ),
      {
        numRuns: Number(process.env.PROPERTY_RUNS ?? 4),
        seed: Number(process.env.PROPERTY_SEED ?? 20261103),
      }
    )
  })
})
