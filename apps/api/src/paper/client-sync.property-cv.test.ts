import { paperDocumentSchema, type PaperDocument } from "@workspace/domain"
import fc from "fast-check"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import {
  edited,
  flat,
  movedAfter,
  openTab,
  serverDoc,
  textOf,
  wordsOf,
  type Tab,
} from "../test/paper-client.js"

const RUNS = Number(process.env.PAPER_SYNC_RUNS ?? 1)
const STEPS = Number(process.env.PAPER_SYNC_STEPS ?? 8)
const SEED = Number(process.env.PAPER_SYNC_SEED ?? 1045)

const step = fc.record({
  kind: fc.constantFrom(
    "type",
    "header",
    "field",
    "title",
    "skillAdd",
    "skillDrop",
    "skillSplit",
    "move",
    "split",
    "join",
    "addSection",
    "dropSection",
    "sync",
    "sync",
    "coachField",
    "coachHeader",
    "coachInto",
    "coachMove",
    "coachRemove"
  ),
  tab: fc.nat(1),
  a: fc.nat(1000),
  b: fc.nat(1000),
})

type Step = { kind: string; tab: number; a: number; b: number }
type Node = {
  id: string
  type: string
  content?: { text: string }[]
  children?: Node[]
  items?: string[]
  title?: string
  kind?: string
  label?: string
  role?: string
  company?: string
  period?: string
  location?: string
  school?: string
  degree?: string
  detail?: string
}

const HEADER_KEYS = ["name", "email", "phone", "city", "linkedin"] as const
const ENTRY_FIELDS = {
  experience: ["role", "company", "period", "location"],
  education: ["school", "degree", "period", "detail"],
  skills: ["label"],
  section: ["kind", "title"],
} as const

let h: CoachStore
let serial = 0

const pick = <T>(items: readonly T[], at: number): T | undefined =>
  items.length === 0 ? undefined : items[at % items.length]

const bullet = (id: string, text: string, children: Node[] = []): Node => ({
  id,
  type: "bullet",
  content: [{ text }],
  children,
})

function seed(): PaperDocument {
  return {
    version: 3,
    kind: "cv",
    header: {
      id: "header",
      type: "header",
      name: "Ada",
      email: "ada@ex.com",
      phone: "1",
      city: "London",
      linkedin: "ada",
    },
    blocks: [
      { id: "s1", type: "section", kind: "experience", title: "Experience" },
      {
        id: "e1",
        type: "experience",
        role: "Analyst",
        company: "Babbage",
        period: "1842",
        location: "London",
        children: [
          bullet("u1", "alpha beta", [
            bullet("u2", "gamma", [bullet("u3", "epsilon")]),
          ]),
          bullet("u4", "zeta eta"),
        ],
      },
      { id: "s2", type: "section", kind: "education", title: "Education" },
      {
        id: "d1",
        type: "education",
        school: "School",
        degree: "Maths",
        period: "1835",
        detail: "Notes",
        children: [bullet("u5", "theta iota")],
      },
      { id: "s3", type: "section", kind: "skills", title: "Skills" },
      {
        id: "k1",
        type: "skills",
        label: "Tools",
        items: ["Figma", "SQL", "C, C++"],
      },
    ],
    clashes: [],
  } as PaperDocument
}

function nodes(doc: PaperDocument): Node[] {
  return doc.blocks as unknown as Node[]
}

function clone(doc: PaperDocument): PaperDocument {
  return structuredClone(doc)
}

function accept(doc: PaperDocument): PaperDocument | null {
  return paperDocumentSchema.safeParse(doc).success ? doc : null
}

function parentOf(
  blocks: Node[],
  id: string
): { list: Node[]; index: number } | null {
  const at = blocks.findIndex((block) => block.id === id)
  if (at >= 0) return { list: blocks, index: at }
  for (const block of blocks) {
    if (!block.children) continue
    const inner = parentOf(block.children, id)
    if (inner) return inner
  }
  return null
}

function fieldValue(doc: PaperDocument, key: string): string | undefined {
  const [id, name] = key.split(".")
  if (!id || !name || doc.kind !== "cv") return undefined
  if (id === "header") {
    const value = doc.header[name as (typeof HEADER_KEYS)[number]]
    return typeof value === "string" ? value : undefined
  }
  const block = flat(doc.blocks).find((item) => item.id === id) as
    Node | undefined
  if (!block) return undefined
  if (name === "items") return JSON.stringify(block.items ?? [])
  const value = block[name as keyof Node]
  return typeof value === "string" ? value : undefined
}

function subtreeWords(doc: PaperDocument, id: string) {
  const block = flat(doc.blocks).find((item) => item.id === id)
  if (!block) return []
  return wordsOf({ ...doc, blocks: [block] } as PaperDocument)
}

type FieldLog = Map<string, { person: string[]; coach: string[] }>

function note(
  log: FieldLog,
  side: "person" | "coach",
  key: string,
  value: string
) {
  const row = log.get(key) ?? { person: [], coach: [] }
  row[side].push(value)
  log.set(key, row)
}

function releaseDropped(
  log: FieldLog,
  tabs: Tab[],
  current: Tab,
  sectionId: string
) {
  const base = seed()
  for (const key of log.keys()) {
    if (!key.startsWith(`${sectionId}.`)) continue
    const held = tabs.some(
      (tab) =>
        tab !== current && fieldValue(tab.doc(), key) !== fieldValue(base, key)
    )
    if (held) continue
    const row = log.get(key)
    if (row) row.person = []
  }
}

export async function play(steps: Step[], twoTabs: boolean) {
  serial += 1
  const made = await h.run("paper.create", { kind: "cv", name: "CV" })
  const docId = (made.output as { id: string }).id
  const first = openTab(h, docId, { gc: false })
  await first.round()
  first.edit(() => seed())
  await first.settle(2)
  const tabs: Tab[] = [first]
  if (twoTabs) {
    const second = openTab(h, docId, { gc: false })
    await second.settle(2)
    tabs.push(second)
  }
  let n = 0
  const token = (prefix: string) => {
    n += 1
    return `${prefix}${serial}n${n}x`
  }
  const live = new Set<string>()
  const copied = new Set<string>()
  const touched = new Set<string>()
  const log: FieldLog = new Map()
  const revisions: { revision: number; doc: PaperDocument }[] = []
  const remember = async () => {
    const now = await serverDoc(h, docId)
    revisions.push(now)
    return now
  }
  await remember()

  for (const s of steps) {
    const tab = tabs[s.tab % tabs.length]!
    const doc = tab.doc()
    const blocks = nodes(doc)
    const tops = blocks.map((block) => block.id)
    const bullets = flat(blocks).filter((block) => block.type === "bullet")
    const entries = blocks.filter((block) =>
      ["experience", "education", "skills"].includes(block.type)
    )
    const write = (next: PaperDocument | null) => {
      if (next) tab.edit(() => next)
    }
    if (s.kind === "type") {
      const target = pick(bullets, s.a)
      if (!target) continue
      const word = token("w")
      live.add(word)
      touched.add(target.id)
      tab.edit((current) =>
        edited(current, target.id, (text) => `${text} ${word}`.trim())
      )
    } else if (s.kind === "header") {
      const key = pick(HEADER_KEYS, s.a)!
      const value = token("f")
      const next = clone(doc)
      if (next.kind !== "cv") continue
      next.header = { ...next.header, [key]: value }
      write(next)
      note(log, "person", `header.${key}`, value)
    } else if (s.kind === "field") {
      const entry = pick(entries, s.a)
      if (!entry || entry.type === "skills") continue
      const names =
        entry.type === "experience"
          ? ENTRY_FIELDS.experience
          : ENTRY_FIELDS.education
      const key = pick(names, s.b)!
      const value = token("f")
      const next = clone(doc)
      const node = nodes(next).find((block) => block.id === entry.id)
      if (!node) continue
      node[key] = value
      write(next)
      note(log, "person", `${entry.id}.${key}`, value)
    } else if (s.kind === "title") {
      const section = pick(
        blocks.filter((block) => block.type === "section"),
        s.a
      )
      if (!section) continue
      const value = token("f")
      const next = clone(doc)
      const node = nodes(next).find((block) => block.id === section.id)
      if (!node) continue
      node.title = value
      write(next)
      note(log, "person", `${section.id}.title`, value)
    } else if (
      s.kind === "skillAdd" ||
      s.kind === "skillDrop" ||
      s.kind === "skillSplit"
    ) {
      const group = blocks.find((block) => block.type === "skills")
      if (!group?.items) continue
      const next = clone(doc)
      const node = nodes(next).find((block) => block.id === group.id)
      if (!node?.items) continue
      if (s.kind === "skillAdd") node.items.push(token("f"))
      else if (s.kind === "skillDrop" && node.items.length > 0) {
        node.items.splice(s.a % node.items.length, 1)
      } else {
        const at = node.items.findIndex((item) => item.includes(","))
        if (at < 0) node.items.push(`${token("f")}, ${token("f")}`)
        else {
          const parts = node.items[at]!.split(",")
            .map((part) => part.trim())
            .filter(Boolean)
          if (parts.length < 2) continue
          node.items.splice(at, 1, ...parts)
        }
      }
      write(next)
      note(log, "person", `${group.id}.items`, JSON.stringify(node.items))
    } else if (s.kind === "move" && entries.length > 0 && tops.length > 1) {
      const entry = pick(entries, s.a)!
      const after = pick(
        tops.filter((id) => id !== entry.id),
        s.b
      )!
      write(accept(movedAfter(doc, entry.id, after)))
    } else if (s.kind === "split") {
      const target = pick(bullets, s.a)
      const text = target ? (textOf(doc, target.id) ?? "") : ""
      const cut = text.indexOf(" ")
      if (!target || cut <= 0) continue
      const next = clone(doc)
      const place = parentOf(nodes(next), target.id)
      if (!place) continue
      place.list[place.index] = {
        ...place.list[place.index]!,
        content: [{ text: text.slice(0, cut) }],
      }
      const id = `s${token("i")}`
      place.list.splice(place.index + 1, 0, bullet(id, text.slice(cut + 1)))
      if (twoTabs && touched.has(target.id)) {
        for (const word of text.split(" ")) copied.add(word)
      }
      write(next)
    } else if (s.kind === "join") {
      const target = pick(bullets, s.a)
      if (!target) continue
      const place = parentOf(blocks, target.id)
      const previous =
        place && place.index > 0 ? place.list[place.index - 1] : undefined
      if (
        !place ||
        previous?.type !== "bullet" ||
        (target.children?.length ?? 0) > 0
      ) {
        continue
      }
      const left = textOf(doc, previous.id) ?? ""
      const right = textOf(doc, target.id) ?? ""
      const next = clone(doc)
      const again = parentOf(nodes(next), target.id)
      if (!again) continue
      const host = again.list[again.index - 1]!
      host.content = [{ text: `${left} ${right}`.trim() }]
      again.list.splice(again.index, 1)
      if (twoTabs && (touched.has(target.id) || touched.has(previous.id))) {
        for (const word of `${left} ${right}`.split(" ")) copied.add(word)
      }
      write(next)
    } else if (s.kind === "addSection") {
      const next = clone(doc)
      nodes(next).push({
        id: `s${token("i")}`,
        type: "section",
        kind: "projects",
        title: token("f"),
      })
      const added = nodes(next).at(-1)
      if (!added?.title || !added.id) continue
      write(next)
      note(log, "person", `${added.id}.title`, added.title)
    } else if (s.kind === "dropSection") {
      const section = pick(
        blocks.filter((block) => block.type === "section"),
        s.a
      )
      if (!section) continue
      const next = clone(doc)
      const list = nodes(next).filter((block) => block.id !== section.id)
      ;(next as { blocks: Node[] }).blocks = list
      const accepted = accept(next)
      write(accepted)
      if (accepted) releaseDropped(log, tabs, tab, section.id)
    } else if (s.kind === "sync") {
      if (tab.inFlight) tab.deliver()
      await tab.round()
    } else if (s.kind.startsWith("coach")) {
      const known = revisions.at(-1 - (s.a % Math.min(3, revisions.length)))!
      const body = nodes(known.doc)
      const knownEntries = body.filter((block) =>
        ["experience", "education", "skills", "section"].includes(block.type)
      )
      const target = pick(knownEntries, s.b)
      let edit: Record<string, unknown> | null = null
      let fieldKey = ""
      let fieldVal = ""
      if (s.kind === "coachHeader") {
        const key = pick(HEADER_KEYS, s.b)!
        fieldVal = token("f")
        fieldKey = `header.${key}`
        edit = { op: "setHeader", fields: { [key]: fieldVal } }
      } else if (
        s.kind === "coachField" &&
        target &&
        target.type !== "section"
      ) {
        if (target.type === "skills" && s.a % 2 === 0) {
          const items = [token("f")]
          fieldVal = JSON.stringify(items)
          fieldKey = `${target.id}.items`
          edit = { op: "setFields", blockId: target.id, fields: { items } }
        } else {
          const names =
            target.type === "experience"
              ? ENTRY_FIELDS.experience
              : target.type === "education"
                ? ENTRY_FIELDS.education
                : (["label"] as const)
          const key = pick(names, s.a)!
          fieldVal = token("f")
          fieldKey = `${target.id}.${key}`
          edit = {
            op: "setFields",
            blockId: target.id,
            fields: { [key]: fieldVal },
          }
        }
      } else if (s.kind === "coachInto") {
        const holder = pick(
          body.filter(
            (block) => block.type === "experience" || block.type === "education"
          ),
          s.b
        )
        if (holder) {
          const word = token("w")
          edit = {
            op: "insertInto",
            into: holder.id,
            blocks: [{ type: "bullet", text: word }],
          }
          fieldVal = word
          fieldKey = `word:${word}`
        }
      } else if (
        s.kind === "coachMove" &&
        target &&
        target.type !== "section"
      ) {
        const after = pick(
          body.map((block) => block.id).filter((id) => id !== target.id),
          s.a
        )
        if (after) edit = { op: "move", blockId: target.id, after }
      } else if (
        s.kind === "coachRemove" &&
        target &&
        target.type !== "section"
      ) {
        const words = subtreeWords(known.doc, target.id)
        if (!words.some((word) => live.has(word))) {
          edit = { op: "remove", blockId: target.id }
        }
      }
      if (!edit) continue
      try {
        const result = await h.coach(docId, known.revision, [edit])
        const applied = result.output.outcomes.every(
          (outcome) =>
            outcome.status === "applied" || outcome.status === "merged"
        )
        if (applied && fieldKey.startsWith("word:")) live.add(fieldVal)
        if (applied && fieldKey && !fieldKey.startsWith("word:")) {
          note(log, "coach", fieldKey, fieldVal)
        }
      } catch {
        continue
      }
      await remember()
    }
  }

  for (let round = 0; round < 3; round += 1) {
    for (const tab of tabs) {
      if (tab.inFlight) tab.deliver()
      await tab.settle(2)
    }
  }
  const final = await serverDoc(h, docId)
  return { final, tabs, live, copied, log }
}

function countWord(doc: PaperDocument, word: string) {
  return wordsOf(doc).filter((item) => item === word).length
}

function verdict(out: Awaited<ReturnType<typeof play>>) {
  const parsed = paperDocumentSchema.safeParse(out.final.doc)
  expect(parsed.success, parsed.success ? "" : parsed.error.message).toBe(true)
  const ids = [
    ...(out.final.doc.kind === "cv" ? [out.final.doc.header.id] : []),
    ...flat(out.final.doc.blocks).map((block) => block.id),
  ]
  expect(new Set(ids).size).toBe(ids.length)
  for (const tab of out.tabs) {
    expect(tab.failures).toBe(0)
    expect(tab.doc()).toEqual(out.final.doc)
    expect(paperDocumentSchema.safeParse(tab.doc()).success).toBe(true)
  }
  for (const word of out.live) {
    const seen = countWord(out.final.doc, word)
    if (out.copied.has(word)) expect(seen).toBeGreaterThan(0)
    else expect(seen).toBe(1)
  }
  for (const [key, row] of out.log) {
    const actual = fieldValue(out.final.doc, key)
    if (row.person.length === 0 && row.coach.length === 0) continue
    if (actual === undefined) {
      expect(row.person, key).toEqual([])
      continue
    }
    if (row.person.length === 1 && row.coach.length === 0) {
      expect(actual, key).toBe(row.person[0])
    } else if (row.person.length === 0) {
      expect(actual, key).toBe(row.coach.at(-1))
    } else {
      expect([...row.person, ...row.coach], key).toContain(actual)
    }
  }
}

describe("CV client sync keeps fields and person words", () => {
  beforeAll(async () => {
    h = await openCoachStore("user-cv-sync")
  })

  afterAll(async () => {
    await h.store.client.close()
  })

  for (const twoTabs of [false, true]) {
    it(
      `no blend and no lost word (${twoTabs ? "two tabs" : "one tab"}, seed ${SEED})`,
      () =>
        h.inDatabase(async () => {
          await fc.assert(
            fc.asyncProperty(
              fc.array(step, { minLength: 4, maxLength: STEPS }),
              async (steps) => {
                verdict(await play(steps, twoTabs))
              }
            ),
            { numRuns: RUNS, seed: SEED }
          )
        }),
      Number(process.env.PAPER_SYNC_TIMEOUT ?? 15_000)
    )
  }
})
