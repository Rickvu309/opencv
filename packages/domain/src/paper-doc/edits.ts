import {
  paperDocumentSchema,
  sectionMarker,
  type PaperDocument,
} from "./document.js"
import {
  EDIT_START,
  type NewBlock,
  type PaperEdit,
  type PaperEditOutcome,
} from "./edits-schema.js"
import {
  fieldSetMisfit,
  HEADER_NODE_ID,
  type CvPaperBlock,
  type ListItem,
  type NodeFieldSet,
  type NodeId,
  type PaperNode,
} from "./nodes.js"
import { insertedRuns } from "./text-align.js"
import { richTextFromInlineMarkdown } from "./rich-text.js"
import {
  canonical,
  childrenOf,
  cloned,
  fieldsOf,
  indexOf,
  type Entry,
  type Index,
} from "./tree.js"

type Item = {
  readonly text: string
  readonly children?: readonly Item[] | undefined
}

export type AppliedEdits = {
  readonly target: PaperDocument
  readonly outcomes: PaperEditOutcome[]
  readonly applied: number
  readonly moved: ReadonlySet<string>
  readonly effects: EditEffect[]
}

const LETTER_TYPES: readonly string[] = [
  "paragraph",
  "heading",
  "bullet",
  "numbered",
  "divider",
]

function neighbourIn(entry: Entry, others: Index): string {
  if (!entry.list) return HEADER_NODE_ID
  const at = entry.list.indexOf(entry.node)
  for (let i = at - 1; i >= 0; i -= 1) {
    const sibling = entry.list[i]!
    if (others.has(sibling.id)) return sibling.id
  }
  return EDIT_START
}

function placeOf(entry: Entry, others: Index): string {
  return `${entry.owner}/${neighbourIn(entry, others)}`
}

function subtreeIds(node: PaperNode): Set<string> {
  const ids = new Set<string>([node.id])
  for (const child of childrenOf(node) ?? []) {
    for (const id of subtreeIds(child)) ids.add(id)
  }
  return ids
}

function itemsOf(
  list: readonly Item[] | undefined,
  type: "bullet" | "numbered",
  freshId: () => NodeId
): ListItem[] {
  return (list ?? []).map((item) => ({
    id: freshId(),
    type,
    content: richTextFromInlineMarkdown(item.text),
    children: itemsOf(item.children, type, freshId),
  }))
}

function blockOf(block: NewBlock, freshId: () => NodeId): CvPaperBlock {
  const id = freshId()
  switch (block.type) {
    case "paragraph":
      return {
        id,
        type: "paragraph",
        content: richTextFromInlineMarkdown(block.text),
      }
    case "heading":
      return {
        id,
        type: "heading",
        level: block.level,
        content: richTextFromInlineMarkdown(block.text),
      }
    case "bullet":
    case "numbered":
      return {
        id,
        type: block.type,
        content: richTextFromInlineMarkdown(block.text),
        children: itemsOf(block.children, block.type, freshId),
      }
    case "divider":
      return { id, type: "divider" }
    case "section": {
      const marker = sectionMarker(block.kind, id)
      return block.title === undefined
        ? marker
        : { ...marker, title: block.title }
    }
    case "experience":
      return {
        id,
        type: "experience",
        role: block.role,
        company: block.company,
        period: block.period,
        location: block.location,
        children: itemsOf(block.bullets, "bullet", freshId),
      }
    case "education":
      return {
        id,
        type: "education",
        school: block.school,
        degree: block.degree,
        period: block.period,
        detail: block.detail,
        children: itemsOf(block.bullets, "bullet", freshId),
      }
    case "skills":
      return {
        id,
        type: "skills",
        label: block.label,
        items: block.items,
      }
  }
}

function problemWith(doc: PaperDocument): string | null {
  const parsed = paperDocumentSchema.safeParse(doc)
  if (parsed.success) return null
  return parsed.error.issues[0]?.message ?? "The result is not a valid document"
}

type Context = {
  readonly base: Index
  readonly live: Index
  readonly freshId: () => NodeId
  readonly newerCoachBlocks: ReadonlySet<string>
  movedNow: string[]
}

type Found = {
  readonly entry: Entry
  readonly base: Entry
  readonly live: Entry
}

const invalid = (reason: string): PaperEditOutcome => ({
  status: "invalid",
  reason,
})
const stale = (reason: string): PaperEditOutcome => ({
  status: "stale",
  reason,
})

function stalenessOf(context: Context, id: string): PaperEditOutcome | null {
  let current = id
  for (;;) {
    const inBase = context.base.get(current)
    const inLive = context.live.get(current)
    if (!inBase) return null
    const label =
      current === id ? `Block ${id}` : `Block ${id} sits in ${current}, which`
    if (!inLive) {
      return stale(`${label} was deleted since you read the document`)
    }
    if (inBase.node.type !== inLive.node.type) {
      return stale(`${label} changed its type since you read the document`)
    }
    if (placeOf(inBase, context.live) !== placeOf(inLive, context.base)) {
      return stale(`${label} was moved since you read the document`)
    }
    const next = inBase.owner
    if (next === current || next === "body") return null
    current = next
  }
}

function find(
  work: PaperDocument,
  context: Context,
  id: string
): Found | PaperEditOutcome {
  const inBase = context.base.get(id)
  if (!inBase)
    return invalid(`There is no block ${id} in the document you read`)
  const inWork = indexOf(work).get(id)
  if (!inWork) return invalid(`Block ${id} was removed earlier in this edit`)
  const inLive = context.live.get(id)
  if (!inLive)
    return stale(`Block ${id} was deleted since you read the document`)
  const staleness = stalenessOf(context, id)
  if (staleness) return staleness
  if (context.newerCoachBlocks.has(id)) {
    return stale(
      `Block ${id} was changed by a newer edit of yours. Read paper.outline again and use its revision as basedOn`
    )
  }
  return { entry: inWork, base: inBase, live: inLive }
}

function isOutcome(value: Found | PaperEditOutcome): value is PaperEditOutcome {
  return "status" in value
}

function anchor(
  work: PaperDocument,
  context: Context,
  id: string
): { list: PaperNode[]; at: number } | PaperEditOutcome {
  if (id === EDIT_START) return { list: work.blocks as PaperNode[], at: 0 }
  if (!context.base.has(id)) {
    return invalid(`There is no block ${id} in the document you read`)
  }
  const inWork = indexOf(work).get(id)
  if (!inWork) return invalid(`Block ${id} was removed earlier in this edit`)
  if (!context.live.has(id)) {
    return stale(`Block ${id} was deleted since you read the document`)
  }
  const staleness = stalenessOf(context, id)
  if (staleness) return staleness
  if (!inWork.list) return { list: work.blocks as PaperNode[], at: 0 }
  return { list: inWork.list, at: inWork.list.indexOf(inWork.node) + 1 }
}

function isAnchor(
  value: { list: PaperNode[]; at: number } | PaperEditOutcome
): value is { list: PaperNode[]; at: number } {
  return "list" in value
}

function misfitOfBlocks(
  work: PaperDocument,
  blocks: readonly NewBlock[]
): string | null {
  if (work.kind !== "letter") return null
  const other = blocks.find((block) => !LETTER_TYPES.includes(block.type))
  return other ? `A letter cannot hold a ${other.type}` : null
}

function insertEdit(
  work: PaperDocument,
  context: Context,
  edit: Extract<PaperEdit, { op: "insert" | "insertInto" }>
): PaperEditOutcome {
  const misfit = misfitOfBlocks(work, edit.blocks)
  if (misfit) return invalid(misfit)
  let place: { list: PaperNode[]; at: number }
  if (edit.op === "insert") {
    const found = anchor(work, context, edit.after)
    if (!isAnchor(found)) return found
    place = found
  } else {
    const parent = anchor(work, context, edit.into)
    if (!isAnchor(parent)) return parent
    const holder = indexOf(work).get(edit.into)
    const kids = holder ? childrenOf(holder.node) : null
    if (!kids) return invalid(`Block ${edit.into} cannot hold list items`)
    if (
      edit.blocks.some((block) => !["bullet", "numbered"].includes(block.type))
    ) {
      return invalid("Only list items go inside a block")
    }
    place = { list: kids, at: kids.length }
  }
  const created = edit.blocks.map((block) => blockOf(block, context.freshId))
  place.list.splice(place.at, 0, ...created)
  return { status: "applied", createdIds: created.map((block) => block.id) }
}

function setTextEdit(
  work: PaperDocument,
  context: Context,
  edit: Extract<PaperEdit, { op: "setText" }>
): PaperEditOutcome {
  const found = find(work, context, edit.blockId)
  if (isOutcome(found)) return found
  const node = found.entry.node as PaperNode & Record<string, unknown>
  if (node.type === "section") {
    node.title = edit.text
  } else if ("content" in node) {
    node.content = richTextFromInlineMarkdown(edit.text)
  } else {
    return invalid(
      `A ${node.type} holds no running text. Use setFields for its fields`
    )
  }
  const changedByPerson =
    canonical(found.base.node) !== canonical(found.live.node)
  return changedByPerson
    ? { status: "applied", merged: true }
    : { status: "applied" }
}

function setEntries(fields: NodeFieldSet) {
  return Object.entries(fields).filter(([, value]) => value !== undefined)
}

function assignFields(
  found: Found,
  fields: NodeFieldSet,
  label: string
): PaperEditOutcome {
  const entries = setEntries(fields)
  if (entries.length === 0) return invalid("There is nothing to set")
  const misfit = fieldSetMisfit(found.entry.node.type, fields)
  if (misfit) return invalid(misfit)
  const before = found.base.node as Record<string, unknown>
  const now = found.live.node as Record<string, unknown>
  const changed = entries.find(
    ([key]) => canonical(before[key]) !== canonical(now[key])
  )
  if (changed) {
    return stale(`${label} ${changed[0]} changed since you read the document`)
  }
  Object.assign(found.entry.node, Object.fromEntries(entries))
  return { status: "applied" }
}

function setFieldsEdit(
  work: PaperDocument,
  context: Context,
  edit: Extract<PaperEdit, { op: "setFields" }>
): PaperEditOutcome {
  const found = find(work, context, edit.blockId)
  if (isOutcome(found)) return found
  return assignFields(found, edit.fields, `Block ${edit.blockId}:`)
}

function setHeaderEdit(
  work: PaperDocument,
  context: Context,
  edit: Extract<PaperEdit, { op: "setHeader" }>
): PaperEditOutcome {
  if (work.kind !== "cv") return invalid("A letter has no header")
  const found = find(work, context, HEADER_NODE_ID)
  if (isOutcome(found)) return found
  return assignFields(found, edit.fields, "Header")
}

function unchangedSubtree(found: Found, id: string): PaperEditOutcome | null {
  return canonical(found.base.node) === canonical(found.live.node)
    ? null
    : stale(`Block ${id} changed since you read the document`)
}

const ENTRY_KINDS = ["experience", "education", "skills"]

function leavesEntryUnsectioned(blocks: readonly PaperNode[]): boolean {
  let sectionSeen = false
  for (const block of blocks) {
    if (block.type === "section") sectionSeen = true
    else if (ENTRY_KINDS.includes(block.type) && !sectionSeen) return true
  }
  return false
}

const NO_SECTION =
  "That would leave an entry in the live document with no section before it"

function removeEdit(
  work: PaperDocument,
  context: Context,
  edit: Extract<PaperEdit, { op: "remove" }>
): PaperEditOutcome {
  const found = find(work, context, edit.blockId)
  if (isOutcome(found)) return found
  if (!found.entry.list) return invalid("The header cannot be removed")
  if (found.entry.node.type === "section") {
    const rest = (work.blocks as PaperNode[]).filter(
      (item) => item.id !== edit.blockId
    )
    if (leavesEntryUnsectioned(rest)) return invalid(NO_SECTION)
  }
  const changed = unchangedSubtree(found, edit.blockId)
  if (changed) return changed
  found.entry.list.splice(found.entry.list.indexOf(found.entry.node), 1)
  return { status: "applied" }
}

function moveEdit(
  work: PaperDocument,
  context: Context,
  edit: Extract<PaperEdit, { op: "move" }>
): PaperEditOutcome {
  const found = find(work, context, edit.blockId)
  if (isOutcome(found)) return found
  if (!found.entry.list) return invalid("The header cannot be moved")
  if (subtreeIds(found.entry.node).has(edit.after)) {
    return invalid("A block cannot move next to itself or into itself")
  }
  const changed = unchangedSubtree(found, edit.blockId)
  if (changed) return changed
  if (found.entry.node.type === "section") {
    const rest = (work.blocks as PaperNode[]).filter(
      (item) => item.id !== edit.blockId
    )
    const anchorAt = rest.findIndex((item) => item.id === edit.after)
    const at =
      edit.after === EDIT_START
        ? 0
        : anchorAt === -1
          ? rest.length
          : anchorAt + 1
    const moved = [...rest.slice(0, at), found.entry.node, ...rest.slice(at)]
    if (leavesEntryUnsectioned(moved)) return invalid(NO_SECTION)
  }
  const target = anchor(work, context, edit.after)
  if (!isAnchor(target)) return target
  found.entry.list.splice(found.entry.list.indexOf(found.entry.node), 1)
  const after = anchor(work, context, edit.after)
  if (!isAnchor(after)) return after
  after.list.splice(after.at, 0, found.entry.node)
  context.movedNow.push(edit.blockId)
  return { status: "applied" }
}

function step(
  work: PaperDocument,
  context: Context,
  edit: PaperEdit
): PaperEditOutcome {
  switch (edit.op) {
    case "insert":
    case "insertInto":
      return insertEdit(work, context, edit)
    case "setText":
      return setTextEdit(work, context, edit)
    case "setFields":
      return setFieldsEdit(work, context, edit)
    case "setHeader":
      return setHeaderEdit(work, context, edit)
    case "move":
      return moveEdit(work, context, edit)
    case "remove":
      return removeEdit(work, context, edit)
  }
}

function idSupplier(
  base: PaperDocument,
  live: PaperDocument,
  newId: () => string
) {
  const used = new Set([...indexOf(base).keys(), ...indexOf(live).keys()])
  return (): NodeId => {
    for (let tries = 0; tries < 50; tries += 1) {
      const id = newId()
      if (/^[A-Za-z0-9_-]{1,64}$/.test(id) && !used.has(id)) {
        used.add(id)
        return id as NodeId
      }
    }
    throw new Error("Could not make a fresh block id")
  }
}

export type EditEffect =
  | { op: number; kind: "created"; id: string; owner: string }
  | { op: number; kind: "text"; id: string; inserted: string }
  | { op: number; kind: "fields"; id: string; fields: Record<string, string> }
  | { op: number; kind: "removed"; id: string }
  | { op: number; kind: "moved"; id: string; owner: string }

function effectsOf(
  op: number,
  edit: PaperEdit,
  outcome: PaperEditOutcome,
  attempt: PaperDocument,
  context: Context
): EditEffect[] {
  const after = indexOf(attempt)
  switch (edit.op) {
    case "insert":
    case "insertInto":
      return (
        outcome.status === "applied" ? (outcome.createdIds ?? []) : []
      ).map((id) => ({ op, kind: "created", id, owner: after.get(id)!.owner }))
    case "setText": {
      const was = fieldsOf(context.base.get(edit.blockId)!.node, false).text
      const now = fieldsOf(after.get(edit.blockId)!.node, false).text
      const key = "title" in now ? "title" : "content"
      const runs = insertedRuns(was[key] ?? "", now[key] ?? "")
      return [
        { op, kind: "text", id: edit.blockId, inserted: (runs ?? []).join("") },
      ]
    }
    case "setFields":
    case "setHeader": {
      const id = edit.op === "setHeader" ? HEADER_NODE_ID : edit.blockId
      const props = fieldsOf(after.get(id)!.node, false).props
      const keys = Object.keys(edit.fields)
      return [
        {
          op,
          kind: "fields",
          id,
          fields: Object.fromEntries(
            keys.map((key) => [key, props[key] ?? ""])
          ),
        },
      ]
    }
    case "remove":
      return [{ op, kind: "removed", id: edit.blockId }]
    case "move":
      return [
        {
          op,
          kind: "moved",
          id: edit.blockId,
          owner: after.get(edit.blockId)!.owner,
        },
      ]
  }
}

export function applyPaperEdits(
  base: PaperDocument,
  live: PaperDocument,
  edits: readonly PaperEdit[],
  newId: () => string,
  newerCoachBlocks: ReadonlySet<string> = new Set()
): AppliedEdits {
  const context: Context = {
    base: indexOf(base),
    live: indexOf(live),
    freshId: idSupplier(base, live, newId),
    newerCoachBlocks,
    movedNow: [],
  }
  let work = cloned(base)
  const outcomes: PaperEditOutcome[] = []
  const effects: EditEffect[] = []
  const moved = new Set<string>()
  let applied = 0
  edits.forEach((edit, op) => {
    const attempt = cloned(work)
    context.movedNow = []
    const outcome = step(attempt, context, edit)
    if (outcome.status !== "applied") {
      outcomes.push(outcome)
      return
    }
    const problem = problemWith(attempt)
    if (problem) {
      outcomes.push(invalid(problem))
      return
    }
    effects.push(...effectsOf(op, edit, outcome, attempt, context))
    for (const id of context.movedNow) moved.add(id)
    work = attempt
    applied += 1
    outcomes.push(outcome)
  })
  return { target: work, outcomes, applied, moved, effects }
}
