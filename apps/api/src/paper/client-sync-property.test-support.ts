import { appendFileSync, writeFileSync } from "node:fs"

import fc from "fast-check"
import type { PaperDocument } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import {
  edited,
  flat,
  li,
  letterOf,
  movedAfter,
  openTab,
  p,
  serverDoc,
  textOf,
  without,
  wordsOf,
  type Tab,
} from "../test/paper-client.js"

const RUNS = Number(process.env.PAPER_SYNC_RUNS ?? 4)
const STEPS = Number(process.env.PAPER_SYNC_STEPS ?? 12)

let h: CoachStore

const step = fc.record({
  kind: fc.constantFrom(
    "type",
    "type",
    "type",
    "erase",
    "addBlock",
    "deleteBlock",
    "move",
    "bold",
    "split",
    "merge",
    "retype",
    "retype",
    "relevel",
    "sync",
    "sync",
    "launch",
    "deliver",
    "coachSet",
    "coachSet",
    "coachInsert",
    "coachMove",
    "coachRemove",
    "coachLevel",
    "undo"
  ),
  tab: fc.nat(1),
  a: fc.nat(1000),
  b: fc.nat(1000),
})

export type Step = {
  kind: string
  tab: number
  a: number
  b: number
}

const pick = <T>(items: readonly T[], at: number): T | undefined =>
  items.length === 0 ? undefined : items[at % items.length]

function ancestorsOf(
  blocks: { id: string; children?: unknown[] }[],
  id: string
): string[] {
  for (const block of blocks) {
    if (block.id === id) return []
    const inner = ancestorsOf(
      (block.children ?? []) as { id: string; children?: unknown[] }[],
      id
    )
    if (
      inner.length > 0 ||
      flat(block.children ?? []).some((b) => b.id === id)
    ) {
      return [block.id, ...inner]
    }
  }
  return []
}

const TYPE_CHOICES = [
  { type: "paragraph" },
  { type: "heading", level: 2 },
  { type: "heading", level: 3 },
  { type: "bullet" },
  { type: "numbered" },
] as const

type Retypable = ReturnType<typeof li> & { level?: number }

const isList = (type: string) => type === "bullet" || type === "numbered"

function retyped(
  doc: PaperDocument,
  id: string,
  choice: number
): PaperDocument {
  const blocks = [...(doc.blocks as unknown as Retypable[])]
  const at = blocks.findIndex((block) => block.id === id)
  const block = blocks[at]
  if (!block) return doc
  const next = pick(
    TYPE_CHOICES.filter((option) => option.type !== block.type),
    choice
  )!
  const kids = block.children ?? []
  const lifted = isList(block.type) && !isList(next.type) ? kids : []
  const node: Retypable = {
    id: block.id,
    type: next.type,
    ...("level" in next ? { level: next.level } : {}),
    content: block.content,
    ...(isList(next.type) ? { children: isList(block.type) ? kids : [] } : {}),
  }
  blocks.splice(at, 1, node, ...lifted)
  return { ...doc, blocks } as never
}

function releveled(doc: PaperDocument, id: string): PaperDocument {
  const blocks = (doc.blocks as unknown as Retypable[]).map((block) =>
    block.id === id && block.type === "heading"
      ? { ...block, level: block.level === 2 ? 3 : 2 }
      : block
  )
  return { ...doc, blocks } as never
}

export async function play(steps: Step[], twoTabs: boolean, gc: boolean) {
  const made = await h.run("paper.create", { kind: "letter", name: "L" })
  const docId = (made.output as { id: string }).id
  const first = openTab(h, docId, { gc })
  await first.round()
  first.edit(() =>
    letterOf([
      {
        id: "h1",
        type: "heading",
        level: 2,
        content: [{ text: "Dear team" }],
      } as never,
      p("p1", "alpha one"),
      p("p2", "beta two"),
      li("l1", "item", [li("l2", "child")]),
      p("p3", "gamma three"),
    ])
  )
  await first.settle(2)
  const tabs: Tab[] = [first]
  if (twoTabs) {
    const second = openTab(h, docId, { gc })
    await second.settle(2)
    tabs.push(second)
  }

  let serial = 0
  const live = new Set<string>()
  const everyone = new Set<string>()
  const coachEdits: {
    editId: string
    tokens: string[]
    reverted: boolean
    removed?: string
    block: string
  }[] = []
  const touched = new Set<string>()
  const copied = new Set<string>()
  const restructured = new Set<string>()
  const splitWords = new Map<string, string[]>()
  const changedElsewhere = (id: string) =>
    touched.has(id) || coachEdits.some((edit) => edit.block === id)
  const removedWords = new Map<string, string[]>()
  const removalOpenFor = new Map<string, Set<number>>()
  const restored = new Set<string>()
  const inRemovalWindow = (tabIndex: number, id: string) =>
    removedWords.has(id) && (removalOpenFor.get(id)?.has(tabIndex) ?? false)
  const joins: {
    ids: readonly string[]
    tab: number
    landed: boolean
    seenBy: Set<number>
  }[] = []
  const joinedConcurrently = (tabIndex: number, ids: readonly string[]) =>
    twoTabs &&
    joins.some(
      (join) =>
        join.tab !== tabIndex &&
        !join.seenBy.has(tabIndex) &&
        join.ids.some((id) => ids.includes(id))
    )
  const exempt = new Set<string>()
  const revisions: { revision: number; doc: PaperDocument }[] = []
  const remember = async () => {
    const now = await serverDoc(h, docId)
    revisions.push(now)
    return now
  }
  await remember()
  for (const word of wordsOf(first.doc())) everyone.add(word)
  const token = (prefix: string) => {
    serial += 1
    const word = `${prefix}${serial}x`
    everyone.add(word)
    return word
  }
  const idsWith = (doc: PaperDocument) =>
    flat(doc.blocks).filter((block) => block.content !== undefined)

  for (const s of steps) {
    const tabIndex = s.tab % tabs.length
    const tab = tabs[tabIndex]!
    const doc = tab.doc()
    const blocks = idsWith(doc)
    const target = pick(blocks, s.a)
    const tops = (doc.blocks as unknown as { id: string }[]).map((b) => b.id)
    const editsText = ["type", "erase", "bold", "split", "deleteBlock"]
    if (target && editsText.includes(s.kind)) {
      touched.add(target.id)
      for (const id of ancestorsOf(doc.blocks as never, target.id)) {
        touched.add(id)
      }
    }
    if (s.kind === "type" && target) {
      const word = token("w")
      live.add(word)
      tab.edit((d) =>
        edited(d, target.id, (text) =>
          s.tab % 2 ? `${word} ${text}` : `${text} ${word}`
        )
      )
    } else if (s.kind === "erase" && target) {
      const words = (textOf(doc, target.id) ?? "").split(" ")
      const gone = pick(
        words.filter((w) => live.has(w)),
        s.b
      )
      if (gone) {
        live.delete(gone)
        tab.edit((d) =>
          edited(d, target.id, (text) =>
            text
              .split(" ")
              .filter((w) => w !== gone)
              .join(" ")
          )
        )
      }
    } else if (s.kind === "addBlock" && target) {
      const word = token("n")
      live.add(word)
      const id = `n${serial}`
      tab.edit((d) => {
        const copy = [...(d.blocks as unknown as ReturnType<typeof p>[])]
        const at = Math.max(0, tops.indexOf(target.id) + 1)
        copy.splice(at, 0, p(id, word))
        return { ...d, blocks: copy } as never
      })
    } else if (s.kind === "deleteBlock" && target && tops.length > 1) {
      for (const w of wordsOf(letterOf([target as never]) as PaperDocument)) {
        live.delete(w)
        exempt.add(w)
      }
      for (const w of splitWords.get(target.id) ?? []) copied.add(w)
      if (restructured.has(target.id)) {
        for (const w of wordsOf(letterOf([target as never]))) copied.add(w)
      }
      restructured.add(target.id)
      tab.edit((d) => without(d, target.id))
    } else if (s.kind === "move" && tops.length > 1) {
      const mover = pick(tops, s.a)!
      touched.add(mover)
      restructured.add(mover)
      const after = pick(
        tops.filter((id) => id !== mover),
        s.b
      )!
      tab.edit((d) => movedAfter(d, mover, after))
    } else if (s.kind === "retype" && target && tops.includes(target.id)) {
      tab.edit((d) => retyped(d, target.id, s.b))
    } else if (s.kind === "relevel" && target && tops.includes(target.id)) {
      tab.edit((d) => releveled(d, target.id))
    } else if (s.kind === "bold" && target) {
      tab.edit(
        (d) =>
          ({
            ...d,
            blocks: JSON.parse(
              JSON.stringify(d.blocks),
              (_key, value) => value
            ).map(function mark(block: ReturnType<typeof p>): unknown {
              if (block.id === target.id && block.content) {
                const text = block.content.map((r) => r.text).join("")
                const space = text.indexOf(" ")
                return space > 0
                  ? {
                      ...block,
                      content: [
                        { text: text.slice(0, space), bold: true },
                        { text: text.slice(space) },
                      ],
                    }
                  : block
              }
              return block
            }),
          }) as never
      )
    } else if (s.kind === "split" && target && tops.includes(target.id)) {
      const text = textOf(doc, target.id) ?? ""
      const cut = text.indexOf(" ")
      if (cut > 0) {
        if (inRemovalWindow(tabIndex, target.id)) {
          for (const w of text.split(" ")) copied.add(w)
        }
        restructured.add(target.id)
        const id = `s${(serial += 1)}`
        restructured.add(id)
        splitWords.set(id, text.split(" "))
        splitWords.set(target.id, text.split(" "))
        tab.edit((d) => {
          const copy = [...(d.blocks as unknown as ReturnType<typeof p>[])]
          const at = copy.findIndex((b) => b.id === target.id)
          copy[at] = { ...copy[at]!, content: [{ text: text.slice(0, cut) }] }
          copy.splice(at + 1, 0, p(id, text.slice(cut + 1)))
          return { ...d, blocks: copy } as never
        })
      }
    } else if (s.kind === "merge" && tops.length > 1 && true) {
      const at = s.a % (tops.length - 1)
      const first2 = tops[at]!
      const second = tops[at + 1]!
      touched.add(first2)
      touched.add(second)
      if (
        restructured.has(first2) ||
        restructured.has(second) ||
        inRemovalWindow(tabIndex, first2) ||
        inRemovalWindow(tabIndex, second) ||
        (twoTabs && (changedElsewhere(first2) || changedElsewhere(second)))
      ) {
        for (const id of [first2, second]) {
          for (const w of splitWords.get(id) ?? []) copied.add(w)
        }
        for (const w of `${textOf(doc, first2)} ${textOf(doc, second)}`.split(
          " "
        )) {
          copied.add(w)
        }
      }
      if (joinedConcurrently(tabIndex, [first2, second])) {
        for (const edit of coachEdits) {
          if (edit.block !== first2 && edit.block !== second) continue
          for (const w of edit.tokens) copied.add(w)
        }
      }
      joins.push({
        ids: [first2, second],
        tab: tabIndex,
        landed: false,
        seenBy: new Set([tabIndex]),
      })
      restructured.add(first2)
      restructured.add(second)
      const a = textOf(doc, first2)
      const b = textOf(doc, second)
      if (
        a !== null &&
        b !== null &&
        !flat(doc.blocks).find((x) => x.id === second)?.children?.length
      ) {
        tab.edit((d) =>
          without(
            edited(d, first2, () => `${a} ${b}`),
            second
          )
        )
      }
    } else if (s.kind === "sync") {
      const landed = joins.filter((join) => join.landed)
      if (tab.inFlight) tab.deliver()
      await tab.round()
      for (const join of landed) join.seenBy.add(tabIndex)
      for (const join of joins) if (join.tab === tabIndex) join.landed = true
      for (const id of restored) removalOpenFor.get(id)?.delete(tabIndex)
    } else if (s.kind === "launch" && !tab.inFlight) {
      await tab.launch()
    } else if (s.kind === "deliver" && tab.inFlight) {
      tab.deliver()
    } else if (s.kind.startsWith("coach")) {
      const known = revisions.at(-1 - (s.a % Math.min(3, revisions.length)))!
      const at = pick(idsWith(known.doc), s.b)
      if (!at) continue
      const word = token("c")
      let edit: Record<string, unknown> | null = null
      if (s.kind === "coachSet") {
        edit = {
          op: "setText",
          blockId: at.id,
          text: `${textOf(known.doc, at.id) ?? ""} ${word}`,
        }
      } else if (s.kind === "coachInsert") {
        edit = {
          op: "insert",
          at: { after: at.id },
          after: at.id,
          blocks: [{ type: "paragraph", text: word }],
        }
      } else if (s.kind === "coachMove") {
        const to = pick(idsWith(known.doc), s.a + 1)
        if (to && to.id !== at.id) {
          edit = { op: "move", blockId: at.id, after: to.id }
        }
      } else if (s.kind === "coachLevel") {
        const heading = pick(
          idsWith(known.doc).filter((block) => block.type === "heading"),
          s.b
        ) as Retypable | undefined
        if (heading) {
          edit = {
            op: "setFields",
            blockId: heading.id,
            fields: { level: heading.level === 2 ? 3 : 2 },
          }
        }
      } else if (s.kind === "coachRemove") {
        const text = textOf(known.doc, at.id) ?? ""
        const hasLive = text.split(" ").some((w) => live.has(w))
        const kids = (at.children ?? []).length > 0
        if (!hasLive && !kids) {
          for (const w of text.split(" ")) exempt.add(w)
          removedWords.set(at.id, text.split(" "))
          removalOpenFor.set(at.id, new Set(tabs.map((_, index) => index)))
          edit = { op: "remove", blockId: at.id }
        }
      }
      if (edit) {
        try {
          const result = await h.coach(docId, known.revision, [edit])
          const applied = result.output.outcomes.every(
            (o) => o.status === "applied" || o.status === "merged"
          )
          if (applied && result.output.editId) {
            coachEdits.push({
              editId: result.output.editId,
              tokens:
                edit.op === "setText" || edit.op === "insert" ? [word] : [],
              reverted: false,
              block: at.id,
              ...(edit.op === "remove" ? { removed: at.id } : {}),
            })
          }
        } catch {
          continue
        }
        await remember()
      }
    } else if (s.kind === "undo") {
      const edit = pick(
        coachEdits.filter((e) => !e.reverted),
        s.a
      )
      if (edit) {
        try {
          await h.run("paper.revertEdit", { docId, editId: edit.editId })
          edit.reverted = true
          if (edit.removed) restored.add(edit.removed)
          if (edit.removed && restructured.has(edit.removed)) {
            for (const w of removedWords.get(edit.removed) ?? []) copied.add(w)
          }
        } catch {
          continue
        }
        await remember()
      }
    }
  }

  for (let n = 0; n < 3; n += 1) {
    for (const tab of tabs) {
      if (tab.inFlight) tab.deliver()
      await tab.settle(2)
    }
  }
  const final = await serverDoc(h, docId)
  if (twoTabs) {
    for (const [id, words] of splitWords) {
      if (!changedElsewhere(id)) continue
      for (const w of words) copied.add(w)
    }
  }
  return {
    final,
    tabs,
    live,
    everyone,
    coachEdits,
    exempt,
    touched,
    copied,
    restructured,
  }
}

function countWord(doc: PaperDocument, word: string) {
  return wordsOf(doc).join("\n").split(word).length - 1
}

let rebuilds = 0
let finished = 0

export function verdict(out: Awaited<ReturnType<typeof play>>) {
  finished += 1
  for (const tab of out.tabs) rebuilds += tab.client.rebuilds
  const ids = flat(out.final.doc.blocks).map((b) => b.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const tab of out.tabs) {
    expect(tab.doc().blocks).toEqual(out.final.doc.blocks)
    expect(tab.failures).toBe(0)
  }
  for (const word of out.everyone) {
    if (out.copied.has(word)) continue
    expect(countWord(out.final.doc, word)).toBeLessThanOrEqual(1)
  }
  for (const word of out.live) {
    const seen = countWord(out.final.doc, word)
    if (out.copied.has(word)) expect(seen).toBeGreaterThan(0)
    else expect(seen).toBe(1)
  }
  for (const edit of out.coachEdits) {
    if (edit.reverted) {
      if (out.touched.has(edit.block) || out.restructured.has(edit.block)) {
        continue
      }
      for (const word of edit.tokens) {
        expect(countWord(out.final.doc, word)).toBe(0)
      }
      continue
    }
    if (edit.removed && !out.touched.has(edit.removed)) {
      expect(ids).not.toContain(edit.removed)
    }
    for (const word of edit.tokens) {
      if (out.exempt.has(word)) continue
      const seen = countWord(out.final.doc, word)
      if (out.copied.has(word)) expect(seen).toBeGreaterThan(0)
      else expect(seen).toBe(1)
    }
  }
}

export function registerProperty(name: string, twoTabs: boolean, gc: boolean) {
  beforeAll(async () => {
    h = await openCoachStore("user-client-property")
  })

  afterAll(async () => {
    if (process.env.PAPER_SYNC_REBUILDS) {
      appendFileSync(
        process.env.PAPER_SYNC_REBUILDS,
        `${name} seed=${process.env.PAPER_SYNC_SEED ?? "random"} cases=${finished} rebuilds=${rebuilds}\n`
      )
    }
    await h.store.client.close()
  })

  describe("the client keeps every pending character across server replies", () => {
    it(
      `no character lost, none doubled (${name})`,
      () =>
        h.inDatabase(async () => {
          await fc.assert(
            fc.asyncProperty(
              fc.array(step, { minLength: 4, maxLength: STEPS }),
              async (steps) => {
                const out = await play(steps, twoTabs, gc)
                try {
                  verdict(out)
                } catch (error) {
                  if (process.env.PAPER_SYNC_TRACE) {
                    writeFileSync(
                      process.env.PAPER_SYNC_TRACE,
                      JSON.stringify({
                        doc: out.final.doc.blocks,
                        live: [...out.live],
                        edits: out.coachEdits,
                      })
                    )
                  }
                  throw error
                }
              }
            ),
            {
              numRuns: RUNS,
              ...(process.env.PAPER_SYNC_SEED
                ? {
                    seed: Number(process.env.PAPER_SYNC_SEED),
                    path: process.env.PAPER_SYNC_PATH,
                  }
                : {}),
            }
          )
        }),
      Number(process.env.PAPER_SYNC_TIMEOUT ?? 60_000)
    )
  })
}

export type Regression = {
  name: string
  steps: Step[]
  twoTabs: boolean
  gc: boolean
}

export function registerRegressions(cases: Regression[]) {
  beforeAll(async () => {
    h = await openCoachStore("user-client-regression")
  })

  afterAll(async () => {
    await h.store.client.close()
  })

  describe("shrunk property sequences stay fixed", () => {
    for (const found of cases) {
      it(found.name, () =>
        h.inDatabase(async () => {
          const out = await play(found.steps, found.twoTabs, found.gc)
          try {
            verdict(out)
          } catch (error) {
            if (process.env.PAPER_SYNC_TRACE) {
              writeFileSync(
                process.env.PAPER_SYNC_TRACE,
                JSON.stringify({
                  doc: out.final.doc.blocks,
                  live: [...out.live],
                  edits: out.coachEdits,
                })
              )
            }
            throw error
          }
        })
      )
    }
  })
}
