import { collab } from "prosemirror-collab"
import type { Fragment, Node } from "prosemirror-model"
import type {
  EditorState as PmState,
  Plugin,
  Transaction,
} from "prosemirror-state"
import {
  ReplaceStep,
  Step,
  Transform,
  type Mapping,
} from "prosemirror-transform"
import type {
  Change,
  DocCommand,
  EditId,
  Origin,
  Run,
} from "@workspace/domain/paper-doc"

import { paperSchema } from "./schema.js"
import { transactionSteps } from "./wire-steps.js"

export type PendingEdit = {
  edit: EditId
  origin: Origin
  commands: DocCommand[]
}

type Unconfirmed = { step: Step; inverted: Step; origin: Transaction }
type CollabPluginState = { version: number; unconfirmed: Unconfirmed[] }

export type Group = { meta: PendingEdit; steps: Unconfirmed[] }

const pendingMeta = "paperPendingEdit"

export function collabPlugin(version: number, client: string): Plugin {
  return collab({ version, clientID: client })
}

export function tagPending(tr: Transaction, meta: PendingEdit): Transaction {
  return tr.setMeta(pendingMeta, meta)
}

function unconfirmedOf(pm: PmState, plugin: Plugin): Unconfirmed[] {
  return (plugin.getState(pm) as CollabPluginState).unconfirmed
}

export function pendingGroups(pm: PmState, plugin: Plugin): Group[] {
  const groups: Group[] = []
  for (const entry of unconfirmedOf(pm, plugin)) {
    const last = groups.at(-1)
    if (last && last.steps[0]!.origin === entry.origin) {
      last.steps.push(entry)
      continue
    }
    const meta = entry.origin.getMeta(pendingMeta) as PendingEdit | undefined
    if (!meta) throw new Error("A pending step has no edit")
    groups.push({ meta, steps: [entry] })
  }
  return groups
}

export function confirmedDoc(pm: PmState, plugin: Plugin): Node {
  let doc = pm.doc
  const unconfirmed = unconfirmedOf(pm, plugin)
  for (let i = unconfirmed.length - 1; i >= 0; i--) {
    const result = unconfirmed[i]!.inverted.apply(doc)
    if (!result.doc)
      throw new Error(result.failed ?? "Pending step cannot be undone")
    doc = result.doc
  }
  return doc
}

export function sendableChanges(
  pm: PmState,
  plugin: Plugin,
  version: number
): Change[] {
  let doc = confirmedDoc(pm, plugin)
  let base = version
  return pendingGroups(pm, plugin).map(({ meta, steps }) => {
    const transform = new Transform(doc)
    for (const { step } of steps) transform.step(step)
    const wire = transactionSteps(transform)
    const change: Change = {
      edit: meta.edit,
      origin: meta.origin,
      base,
      ...wire,
      commands: meta.commands,
    }
    doc = transform.doc
    base += wire.steps.length
    return change
  })
}

function mergeRanges(ranges: [number, number][]) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const range of sorted) {
    const last = merged.at(-1)
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else merged.push([...range])
  }
  return merged
}

function runsOf(fragment: Fragment): Run[] {
  const runs: Run[] = []
  let seenBlock = false
  fragment.descendants((node) => {
    if (node.isTextblock) {
      if (seenBlock) runs.push({ type: "hard_break" })
      seenBlock = true
      return true
    }
    if (node.isText) {
      const marks = node.marks.map((mark) => mark.toJSON())
      runs.push(
        (marks.length
          ? { type: "text", text: node.text!, marks }
          : { type: "text", text: node.text! }) as Run
      )
      return false
    }
    if (node.type.name === "hard_break") runs.push({ type: "hard_break" })
    return true
  })
  return runs
}

export function lostText(
  steps: readonly Step[],
  dropped: ReadonlySet<number>,
  doc: Node
): Run[] {
  const ranges: [number, number][] = []
  steps.forEach((step, index) => {
    if (!dropped.has(index)) return
    if (!(step instanceof ReplaceStep) || step.slice.size === 0) return
    let from = step.from
    let to = step.from + step.slice.size
    for (const later of steps.slice(index + 1)) {
      const map = later.getMap()
      from = map.map(from, 1)
      to = map.map(to, -1)
    }
    if (to > from) ranges.push([from, to])
  })
  return mergeRanges(ranges).flatMap(([from, to]) =>
    runsOf(doc.slice(from, to).content)
  )
}

type Range = [number, number]

function insertedBy(steps: readonly Step[]): Range[] {
  const ranges: Range[] = []
  steps.forEach((step, index) => {
    if (!(step instanceof ReplaceStep) || step.slice.size === 0) return
    let from = step.from
    let to = step.from + step.slice.size
    for (const later of steps.slice(index + 1)) {
      from = later.getMap().map(from, 1)
      to = later.getMap().map(to, -1)
    }
    if (to > from) ranges.push([from, to])
  })
  return ranges
}

function swallows(step: Step, ranges: readonly Range[]) {
  return (
    step instanceof ReplaceStep &&
    step.to > step.from &&
    ranges.some(([from, to]) => step.from < to && from < step.to)
  )
}

const mirror = (mapping: Mapping, from: number, to: number) =>
  (mapping as unknown as { setMirror(n: number, m: number): void }).setMirror(
    from,
    to
  )

function rebasePending(
  tr: Transaction,
  pending: readonly Unconfirmed[],
  over: readonly Step[]
) {
  for (let i = pending.length - 1; i >= 0; i--) tr.step(pending[i]!.inverted)
  for (const step of over) tr.step(step)
  let foreign = insertedBy(over)
  const kept: Unconfirmed[] = []
  const dropped = new Set<number>()
  let mapFrom = pending.length
  pending.forEach((entry, index) => {
    const mapped = entry.step.map(tr.mapping.slice(mapFrom))
    mapFrom -= 1
    if (!mapped || swallows(mapped, foreign) || tr.maybeStep(mapped).failed) {
      dropped.add(index)
      return
    }
    mirror(tr.mapping, mapFrom, tr.steps.length - 1)
    const map = mapped.getMap()
    foreign = foreign
      .map(([from, to]): Range => [map.map(from, 1), map.map(to, -1)])
      .filter(([from, to]) => to > from)
    kept.push({
      step: mapped,
      inverted: mapped.invert(tr.docs[tr.docs.length - 1]!),
      origin: entry.origin,
    })
  })
  return { kept, dropped }
}

export function receiveChanges(
  pm: PmState,
  plugin: Plugin,
  changes: readonly Change[]
): { tr: Transaction; versions: number; lost: Run[] } {
  const groups = pendingGroups(pm, plugin)
  let confirmed = 0
  let ownSteps = 0
  while (
    confirmed < changes.length &&
    confirmed < groups.length &&
    changes[confirmed]!.edit === groups[confirmed]!.meta.edit
  ) {
    ownSteps += groups[confirmed]!.steps.length
    confirmed += 1
  }
  const pendingEdits = new Set(groups.map((group) => group.meta.edit))
  const foreign = changes.slice(confirmed)
  const stray = foreign.find((change) => pendingEdits.has(change.edit))
  if (stray) throw new Error(`Edit ${stray.edit} came back out of order`)
  const over = foreign.flatMap((change) =>
    change.steps.map((json) => Step.fromJSON(paperSchema, json))
  )
  const collabState = plugin.getState(pm) as CollabPluginState
  const remaining = collabState.unconfirmed.slice(ownSteps)
  const tr = pm.tr
  let unconfirmed = remaining
  let lost: Run[] = []
  if (over.length && remaining.length) {
    const { kept, dropped } = rebasePending(tr, remaining, over)
    unconfirmed = kept
    if (dropped.size)
      lost = lostText(
        remaining.map((entry) => entry.step),
        dropped,
        pm.doc
      )
    tr.setMeta("rebased", remaining.length)
  } else {
    for (const step of over) tr.step(step)
  }
  const version = collabState.version + ownSteps + over.length
  tr.setMeta("addToHistory", false).setMeta(plugin, { version, unconfirmed })
  const versions = changes.reduce((sum, change) => sum + change.steps.length, 0)
  return { tr, versions, lost }
}

export function receiveSegments(
  changes: readonly Change[],
  accepted?: (change: Change) => string | null
): { changes: Change[]; batch: string | null }[] {
  const segments: { changes: Change[]; batch: string | null }[] = []
  for (const change of changes) {
    const batch = accepted?.(change) ?? null
    const last = segments.at(-1)
    if (batch === null && last && last.batch === null) last.changes.push(change)
    else segments.push({ changes: [change], batch })
  }
  return segments
}

export function provable(command: DocCommand): boolean {
  return "expect" in command && typeof command.expect === "string"
    ? command.expect.length > 0
    : false
}

export function rebaseOnto(
  groups: readonly Group[],
  doc: Node,
  landed: ReadonlySet<string>,
  replay: (group: Group) => boolean
): Run[] {
  const steps = groups.flatMap((group) =>
    group.steps.map((entry) => entry.step)
  )
  const dropped = new Set<number>()
  let index = 0
  for (const group of groups) {
    if (landed.has(group.meta.edit)) {
      index += group.steps.length
      continue
    }
    const placed =
      group.meta.commands.length > 0 &&
      group.meta.commands.every(provable) &&
      replay(group)
    for (let i = 0; i < group.steps.length; i++) {
      if (!placed) dropped.add(index)
      index += 1
    }
  }
  return dropped.size ? lostText(steps, dropped, doc) : []
}
