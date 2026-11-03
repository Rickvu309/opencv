import { paperDocumentSchema, type PaperDocument } from "@workspace/domain"
import { expect } from "vitest"

import {
  accept,
  bullet,
  clone,
  ENTRY_FIELDS,
  fieldValue,
  HEADER_KEYS,
  nodes,
  parentOf,
  pick,
  seed,
  subtreeWords,
  type Node,
} from "./cv-sync-doc.js"
import type { CoachStore } from "./paper-coach.js"
import {
  edited,
  flat,
  movedAfter,
  openTab,
  serverDoc,
  textOf,
  wordsOf,
  type Tab,
} from "./paper-client.js"

let h: CoachStore
let serial = 0

export function useCoachStore(store: CoachStore) {
  h = store
}

export type Step = { kind: string; tab: number; a: number; b: number }

type FieldWrite = { value: string; prior: string | undefined; tab?: number }
type FieldLog = Map<string, { person: FieldWrite[]; coach: FieldWrite[] }>

function note(
  log: FieldLog,
  side: "person" | "coach",
  key: string,
  value: string,
  prior: string | undefined,
  tab?: number
) {
  const row = log.get(key) ?? { person: [], coach: [] }
  row[side].push({ value, prior, tab })
  log.set(key, row)
}

function releaseDropped(
  log: FieldLog,
  tabs: Tab[],
  current: Tab,
  sectionId: string,
  before: PaperDocument
) {
  for (const key of log.keys()) {
    if (!key.startsWith(`${sectionId}.`)) continue
    const mine = fieldValue(before, key)
    const row = log.get(key)
    const writer = tabs.indexOf(current)
    const held = tabs.some((tab, index) => {
      if (index === writer) return false
      const value = fieldValue(tab.doc(), key)
      if (value === undefined || value === mine) return false
      return (
        row?.person.some(
          (write) => write.tab === index && write.value === value
        ) ?? false
      )
    })
    if (held || !row) continue
    row.person = []
  }
}

export async function play(steps: Step[], twoTabs: boolean) {
  serial += 1
  const made = await h.run("paper.create", { kind: "cv", name: "CV" })
  const docId = (made.output as { id: string }).id
  const first = openTab(h, docId, { gc: false })
  await first.round()
  first.edit(() => seed())
  await first.round()
  const tabs: Tab[] = [first]
  if (twoTabs) {
    const second = openTab(h, docId, { gc: false })
    await second.round()
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
  const removalOpen = new Map<string, Set<number>>()
  const joins: { ids: string[]; tab: number; seen: Set<number> }[] = []
  const sawSync = (index: number) => {
    for (const open of removalOpen.values()) open.delete(index)
    for (const join of joins) join.seen.add(index)
  }
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
    } else if (s.kind === "erase") {
      const target = pick(bullets, s.a)
      const words = (target ? (textOf(doc, target.id) ?? "") : "")
        .split(" ")
        .filter((word) => live.has(word))
      const gone = pick(words, s.b)
      if (target && gone) {
        live.delete(gone)
        tab.edit((current) =>
          edited(current, target.id, (text) =>
            text
              .split(" ")
              .filter((word) => word !== gone)
              .join(" ")
          )
        )
      }
    } else if (s.kind === "header") {
      const key = pick(HEADER_KEYS, s.a)!
      const value = token("f")
      const next = clone(doc)
      if (next.kind !== "cv") continue
      next.header = { ...next.header, [key]: value }
      write(next)
      note(
        log,
        "person",
        `header.${key}`,
        value,
        fieldValue(doc, `header.${key}`),
        tabs.indexOf(tab)
      )
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
      note(
        log,
        "person",
        `${entry.id}.${key}`,
        value,
        fieldValue(doc, `${entry.id}.${key}`),
        tabs.indexOf(tab)
      )
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
      note(
        log,
        "person",
        `${section.id}.title`,
        value,
        fieldValue(doc, `${section.id}.title`),
        tabs.indexOf(tab)
      )
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
      note(
        log,
        "person",
        `${group.id}.items`,
        JSON.stringify(node.items),
        fieldValue(doc, `${group.id}.items`),
        tabs.indexOf(tab)
      )
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
      if (removalOpen.get(target.id)?.has(tabs.indexOf(tab))) {
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
      const index = tabs.indexOf(tab)
      const concurrent = joins.some(
        (join) =>
          join.tab !== index &&
          !join.seen.has(index) &&
          join.ids.some((id) => id === target.id || id === previous.id)
      )
      if (twoTabs && (touched.has(target.id) || touched.has(previous.id))) {
        for (const word of `${left} ${right}`.split(" ")) copied.add(word)
      }
      if (
        removalOpen.get(target.id)?.has(index) ||
        removalOpen.get(previous.id)?.has(index) ||
        concurrent
      ) {
        for (const word of `${left} ${right}`.split(" ")) copied.add(word)
      }
      joins.push({
        ids: [previous.id, target.id],
        tab: index,
        seen: new Set([index]),
      })
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
      note(
        log,
        "person",
        `${added.id}.title`,
        added.title,
        undefined,
        tabs.indexOf(tab)
      )
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
      if (accepted) releaseDropped(log, tabs, tab, section.id, doc)
    } else if (s.kind === "sync") {
      if (tab.inFlight) tab.deliver()
      await tab.round()
      sawSync(tabs.indexOf(tab))
    } else if (s.kind === "launch" && !tab.inFlight) {
      await tab.launch()
    } else if (s.kind === "deliver" && tab.inFlight) {
      tab.deliver()
    } else if (s.kind.startsWith("coach")) {
      const known = revisions.at(-1 - (s.a % Math.min(3, revisions.length)))!
      const body = nodes(known.doc)
      const knownEntries = body.filter((block) =>
        ["experience", "education", "skills", "section"].includes(block.type)
      )
      const knownBullets = flat(body).filter((block) => block.type === "bullet")
      const target = pick(knownEntries, s.b)
      const bulletTarget = pick(knownBullets, s.b)
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
      } else if (s.kind === "coachSet" && bulletTarget) {
        const word = token("w")
        edit = {
          op: "setText",
          blockId: bulletTarget.id,
          text: `${textOf(known.doc, bulletTarget.id) ?? ""} ${word}`.trim(),
        }
        fieldVal = word
        fieldKey = `word:${word}`
      } else if (s.kind === "coachMove" && bulletTarget && s.a % 2 === 0) {
        const after = pick(
          flat(body)
            .map((block) => block.id)
            .filter((id) => id !== bulletTarget.id),
          s.b
        )
        if (after) edit = { op: "move", blockId: bulletTarget.id, after }
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
      } else if (s.kind === "coachRemove" && bulletTarget && s.a % 2 === 0) {
        const words = subtreeWords(known.doc, bulletTarget.id)
        if (!words.some((word) => live.has(word))) {
          edit = { op: "remove", blockId: bulletTarget.id }
        }
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
          note(log, "coach", fieldKey, fieldVal, undefined)
        }
        if (applied && edit.op === "remove") {
          const id = String(edit.blockId)
          for (const [key, row] of log) {
            if (key.startsWith(`${id}.`)) row.coach = []
          }
          removalOpen.set(id, new Set(tabs.map((_, index) => index)))
        }
      } catch {
        continue
      }
      await remember()
    }
  }

  for (let pass = 0; pass < (twoTabs ? 2 : 1); pass += 1) {
    for (const tab of tabs) {
      if (tab.inFlight) tab.deliver()
      await tab.round()
    }
  }
  const final = await serverDoc(h, docId)
  return { final, tabs, live, copied, log }
}

function countWord(doc: PaperDocument, word: string) {
  return wordsOf(doc).filter((item) => item === word).length
}

export function verdict(out: Awaited<ReturnType<typeof play>>) {
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
    const personKept = row.person.filter((write, index) => {
      const later = row.person.slice(index + 1)
      return !later.some(
        (next) => next.tab === write.tab || next.prior === write.value
      )
    })
    if (personKept.length === 0 && row.coach.length === 0) continue
    if (actual === undefined) {
      expect(personKept, key).toEqual([])
      continue
    }
    const coach = row.coach.at(-1)?.value
    const last = row.person.at(-1)
    if (
      last &&
      coach !== undefined &&
      last.prior === coach &&
      personKept.every((write) => write.value === last.value)
    ) {
      expect(actual, key).toBe(last.value)
      continue
    }
    const allowed = personKept.map((write) => write.value)
    if (coach !== undefined) allowed.push(coach)
    expect(allowed, key).toContain(actual)
  }
}
