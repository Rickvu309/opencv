import { movedIds } from "./changes.js"
import { paperDocumentSchema, type PaperDocument } from "./document.js"
import type { PaperNode } from "./nodes.js"
import {
  copyOf,
  fittedToType,
  keptOver,
  locate,
  mergedFields,
  sameOwn,
  sameText,
  unusedId,
  type Mut,
} from "./rebase-nodes.js"
import { repairPaper } from "./repair.js"
import type { TextRun } from "./rich-text.js"
import { childrenOf, cloned, indexOf, type Index } from "./tree.js"
import {
  containsRun,
  graftRun,
  mergeWords,
  splitMerge,
  wordsOf,
} from "./word-merge.js"

type RebaseInput = {
  readonly base: PaperDocument
  readonly ours: PaperDocument
  readonly theirs: PaperDocument
}

type Origin = "ours" | "theirs"

const TAKES_CHILDREN = new Set([
  "bullet",
  "numbered",
  "experience",
  "education",
])

const isListType = (type: unknown) => type === "bullet" || type === "numbered"

const takesChildren = (type: unknown) => TAKES_CHILDREN.has(String(type))

function nodesOf(index: Index): Map<string, Mut> {
  return new Map(
    [...index].map(([id, entry]) => [id, entry.node as unknown as Mut])
  )
}

class Merge {
  readonly base: Index
  readonly ours: Index
  readonly theirs: Index
  readonly baseNodes: Map<string, Mut>
  readonly ourNodes: Map<string, Mut>
  readonly theirNodes: Map<string, Mut>
  readonly personMoved: Set<string>
  readonly serverMoved: Set<string>
  readonly origin = new Map<string, Origin>()
  readonly built = new Map<string, Mut>()
  readonly extras: { after: string; node: Mut }[] = []
  readonly folds: { y: string; host: string; from: Origin }[] = []
  readonly textOverride = new Map<string, TextRun[]>()
  readonly splitPartner = new Map<string, string>()
  readonly used: Set<string>
  private readonly theirsBlocks: PaperNode[]

  constructor(input: RebaseInput) {
    this.theirsBlocks = input.theirs.blocks as unknown as PaperNode[]
    this.base = indexOf(input.base)
    this.ours = indexOf(input.ours)
    this.theirs = indexOf(input.theirs)
    this.baseNodes = nodesOf(this.base)
    this.ourNodes = nodesOf(this.ours)
    this.theirNodes = nodesOf(this.theirs)
    const removedByServer = new Set(
      [...this.base.keys()].filter((id) => !this.theirs.has(id))
    )
    this.personMoved = movedIds(this.base, this.ours, removedByServer)
    const reparented = new Set(
      [...this.personMoved].filter(
        (id) => this.base.get(id)!.owner !== this.ours.get(id)!.owner
      )
    )
    this.serverMoved = movedIds(this.base, this.theirs, reparented)
    this.used = new Set([
      ...this.base.keys(),
      ...this.ours.keys(),
      ...this.theirs.keys(),
    ])
  }

  private treeIds() {
    return [...this.used].filter(
      (id) =>
        this.base.get(id)?.owner !== "header" &&
        this.ours.get(id)?.owner !== "header" &&
        this.theirs.get(id)?.owner !== "header"
    )
  }

  decide() {
    for (const id of this.treeIds()) {
      const b = this.baseNodes.get(id)
      const o = this.ourNodes.get(id)
      const t = this.theirNodes.get(id)
      if (o && t) {
        const personKept = this.personMoved.has(id) && !this.serverMoved.has(id)
        this.origin.set(id, personKept ? "ours" : "theirs")
      } else if (o) {
        if (!b || !keptOver(b, o)) {
          this.origin.set(id, "ours")
        }
      } else if (t) {
        if (!b || !keptOver(b, t)) this.origin.set(id, "theirs")
      }
    }
    this.findFolds()
    this.findSplits()
    for (const id of [...this.origin.keys()]) {
      if (this.origin.get(id) !== "ours") continue
      let owner = this.ours.get(id)!.owner
      while (owner !== "body" && !this.origin.has(owner)) {
        if (!this.isFolded(owner) && !this.joinedAway(owner)) {
          this.origin.set(owner, "ours")
        }
        owner = this.ours.get(owner)!.owner
      }
    }
  }

  private hostOf(nodes: Map<string, Mut>, y: Mut, skip: string) {
    for (const [id, node] of nodes) {
      if (id === skip || node.content === undefined) continue
      const before = this.baseNodes.get(id)?.content
      if (
        containsRun(node.content, y.content) &&
        !containsRun(before, y.content)
      ) {
        return id
      }
    }
    return null
  }

  private findFolds() {
    for (const [id, b] of this.baseNodes) {
      if (b.content === undefined) continue
      const o = this.ourNodes.get(id)
      const t = this.theirNodes.get(id)
      let host: string | null = null
      let from: Origin = "theirs"
      if (!o && t && !sameOwn(b, t)) {
        host = this.hostOf(this.ourNodes, b, id)
        from = "theirs"
      } else if (o && !t && !sameOwn(b, o)) {
        host = this.hostOf(this.theirNodes, b, id)
        from = "ours"
      }
      if (host === null || !this.origin.has(host)) continue
      this.origin.delete(id)
      this.folds.push({ y: id, host, from })
    }
  }

  private findSplits() {
    for (const [id, y] of [...this.ourNodes, ...this.theirNodes]) {
      if (this.baseNodes.has(id) || y.content === undefined) continue
      const splitIsOurs = this.ourNodes.has(id) && !this.theirNodes.has(id)
      const splitIsTheirs = this.theirNodes.has(id) && !this.ourNodes.has(id)
      if (!splitIsOurs && !splitIsTheirs) continue
      for (const [xid, b] of this.baseNodes) {
        const mine = this.ourNodes.get(xid)
        const other = this.theirNodes.get(xid)
        if (!mine || !other || this.textOverride.has(xid)) continue
        if (sameText(b, mine) || sameText(b, other)) continue
        const result = splitMerge(
          b.content,
          (splitIsOurs ? mine : other).content,
          y.content,
          (splitIsOurs ? other : mine).content,
          splitIsOurs
        )
        if (!result) continue
        this.textOverride.set(xid, result.head as unknown as TextRun[])
        this.textOverride.set(id, result.tail as unknown as TextRun[])
        this.splitPartner.set(xid, id)
        break
      }
    }
  }

  private joinedAway(id: string) {
    const b = this.baseNodes.get(id)
    return (
      b !== undefined &&
      b.content !== undefined &&
      !this.theirNodes.has(id) &&
      this.hostOf(this.theirNodes, b, id) !== null
    )
  }

  private isFolded(id: string) {
    return this.folds.some((fold) => fold.y === id)
  }

  private oursParent(id: string): string {
    let owner = this.ours.get(id)!.owner
    while (owner !== "body" && !this.origin.has(owner)) {
      owner = this.ours.get(owner)!.owner
    }
    return owner
  }

  private effectiveParent(id: string): string {
    if (this.origin.get(id) === "ours") return this.oursParent(id)
    let owner = this.theirs.get(id)!.owner
    while (owner !== "body" && !this.origin.has(owner)) {
      owner = this.theirs.get(owner)!.owner
    }
    return owner
  }

  breakCycles() {
    for (let round = 0; round < 20; round += 1) {
      let broken = false
      for (const start of this.origin.keys()) {
        const seen = new Set<string>()
        let at = start
        while (at !== "body" && !seen.has(at)) {
          seen.add(at)
          at = this.effectiveParent(at)
        }
        if (at === "body") continue
        const member = [...seen].find(
          (id) => this.origin.get(id) === "ours" && this.theirs.has(id)
        )
        if (member === undefined) continue
        this.origin.set(member, "theirs")
        broken = true
        break
      }
      if (!broken) return
    }
  }

  build() {
    for (const id of this.origin.keys()) {
      const b = this.baseNodes.get(id)
      const o = this.ourNodes.get(id)
      const t = this.theirNodes.get(id)
      let node: Mut
      if (!o || !t) {
        node = copyOf((o ?? t)!)
        const override = this.textOverride.get(id)
        if (override) node.content = cloned(override)
      } else {
        node = { ...fittedToType(mergedFields(b, o, t), id, [o, t]), id } as Mut
        const override = this.textOverride.get(id)
        if (override) node.content = cloned(override)
        else if (o.content !== undefined || t.content !== undefined) {
          this.mergeText(node, b, o, t)
        }
      }
      if (takesChildren(node.type)) node.children = []
      else delete node.children
      this.built.set(id, node)
    }
    for (const fold of this.folds) this.graftFold(fold)
  }

  private graftFold(fold: { y: string; host: string; from: Origin }) {
    const base = this.baseNodes.get(fold.y)!
    const other = (
      fold.from === "theirs" ? this.theirNodes : this.ourNodes
    ).get(fold.y)!
    const candidates = [fold.host, this.splitPartner.get(fold.host)]
    for (const id of candidates) {
      const node = id === undefined ? undefined : this.built.get(id)
      if (!node) continue
      const grafted = graftRun(
        base.content,
        other.content,
        node.content,
        fold.from === "ours"
      )
      if (grafted) {
        node.content = grafted as unknown as TextRun[]
        return
      }
    }
    this.extras.push({
      after: fold.host,
      node: { ...copyOf(other), id: unusedId(this.used, fold.y) },
    })
  }

  private mergeText(node: Mut, b: Mut | undefined, o: Mut, t: Mut) {
    if (o.content === undefined || t.content === undefined) {
      node.content = cloned((o.content ?? t.content)!)
      return
    }
    const joined = mergeWords(b?.content, o.content, t.content)
    if (joined) {
      node.content = joined as unknown as TextRun[]
      return
    }
    node.content = cloned(t.content)
    this.extras.push({
      after: node.id,
      node: { ...copyOf(o), id: unusedId(this.used, node.id) },
    })
  }

  private theirChildren(parent: string): PaperNode[] {
    if (parent === "body") return this.theirsBlocks
    const node = this.theirs.get(parent)?.node
    return (node ? childrenOf(node) : null) ?? []
  }

  private collect(kids: readonly PaperNode[], into: string[]) {
    for (const kid of kids) {
      if (this.origin.has(kid.id)) {
        if (this.origin.get(kid.id) === "theirs") into.push(kid.id)
        continue
      }
      this.collect(childrenOf(kid) ?? [], into)
    }
  }

  assemble(oursBlocks: PaperNode[]): Mut[] {
    const lists = new Map<string, string[]>()
    const listOf = (parent: string) => {
      let list = lists.get(parent)
      if (!list) {
        list = []
        this.collect(this.theirChildren(parent), list)
        lists.set(parent, list)
      }
      return list
    }
    const place = (nodes: readonly PaperNode[]) => {
      for (const node of nodes) {
        if (this.origin.get(node.id) === "ours") {
          const parent = this.oursParent(node.id)
          let anchor: PaperNode = node
          while (this.ours.get(anchor.id)!.owner !== parent) {
            anchor = this.ours.get(this.ours.get(anchor.id)!.owner)!.node
          }
          const list = listOf(parent)
          const siblings = this.ours.get(anchor.id)!.list ?? []
          let at = 0
          for (let back = siblings.indexOf(anchor) - 1; back >= 0; back -= 1) {
            const found = list.indexOf(siblings[back]!.id)
            if (found >= 0) {
              at = found + 1
              break
            }
          }
          list.splice(at, 0, node.id)
        }
        place(childrenOf(node) ?? [])
      }
    }
    place(oursBlocks)
    const placed = new Set<string>()
    const grown = (id: string): Mut[] => {
      placed.add(id)
      const node = this.built.get(id)!
      const kids = grow(id)
      if (!takesChildren(node.type)) return [node, ...kids]
      node.children = kids.filter((kid) => isListType(kid.type))
      return [node, ...kids.filter((kid) => !isListType(kid.type))]
    }
    const grow = (parent: string): Mut[] =>
      listOf(parent)
        .filter((id) => !placed.has(id))
        .flatMap(grown)
    const blocks = grow("body")
    for (const id of this.origin.keys()) {
      if (!placed.has(id)) blocks.push(...grown(id))
    }
    for (const extra of this.extras) {
      const found = locate(blocks, extra.after)
      if (found) found.list.splice(found.at + 1, 0, extra.node)
      else blocks.push(extra.node)
    }
    return blocks
  }
}

function wordTally(runs: readonly TextRun[] | undefined) {
  const tally = new Map<string, number>()
  for (const word of wordsOf(runs)) tally.set(word, (tally.get(word) ?? 0) + 1)
  return tally
}

function insertedWords(
  before: readonly TextRun[] | undefined,
  after: readonly TextRun[] | undefined
) {
  const known = wordTally(before)
  const added = new Map<string, number>()
  for (const [word, count] of wordTally(after)) {
    const extra = count - (known.get(word) ?? 0)
    if (extra > 0) added.set(word, extra)
  }
  return added
}

function lacksPersonEdit(
  merge: Merge,
  result: Index,
  covered: ReadonlySet<string>,
  id: string
): boolean {
  const o = merge.ourNodes.get(id)!
  const b = merge.baseNodes.get(id)
  const here = result.get(id)?.node as unknown as Mut | undefined
  if (!here) return true
  if (covered.has(id) || o.content === undefined) return false
  const have = wordTally(here.content)
  for (const [word, count] of insertedWords(b?.content, o.content)) {
    if ((have.get(word) ?? 0) < count) return true
  }
  return false
}

function restoreMissing(
  merge: Merge,
  document: PaperDocument
): PaperDocument | null {
  const result = indexOf(document)
  const covered = new Set([
    ...merge.extras.map((extra) => extra.after),
    ...merge.folds.map((fold) => fold.host),
    ...merge.textOverride.keys(),
  ])
  const folded = new Set(merge.folds.map((fold) => fold.y))
  const missing: string[] = []
  for (const [id, o] of merge.ourNodes) {
    const b = merge.baseNodes.get(id)
    if (merge.ours.get(id)!.owner === "header") continue
    if (folded.has(id) || (b && keptOver(b, o))) continue
    if (lacksPersonEdit(merge, result, covered, id)) missing.push(id)
  }
  if (missing.length === 0) return null
  const fixed = cloned(document)
  const blocks = fixed.blocks as unknown as Mut[]
  const used = new Set<string>([...merge.used, ...result.keys()])
  for (const id of missing) {
    const extra: Mut = {
      ...copyOf(merge.ourNodes.get(id)!),
      id: unusedId(used, id),
    }
    const found = locate(blocks, id)
    if (found) found.list.splice(found.at + 1, 0, extra)
    else blocks.push(extra)
  }
  return fixed
}

function valid(document: PaperDocument): PaperDocument {
  const parsed = paperDocumentSchema.safeParse(document)
  if (parsed.success) return parsed.data
  const repaired = repairPaper(null, document)?.document
  if (!repaired) throw new Error("The merged letter could not be repaired")
  return repaired
}

function withTheirFields(
  nodes: readonly Mut[],
  theirs: Map<string, Mut>
): Mut[] {
  return nodes.map((node) => {
    const other = theirs.get(node.id)
    const shaped: Mut = other
      ? { ...cloned(other), id: node.id }
      : { ...cloned(node) }
    if (node.children) shaped.children = withTheirFields(node.children, theirs)
    else delete shaped.children
    return shaped
  })
}

function structureOnly(input: RebaseInput, merge: Merge): PaperDocument {
  const shaped = cloned(input.ours)
  shaped.blocks = withTheirFields(
    input.ours.blocks as unknown as Mut[],
    merge.theirNodes
  ) as never
  try {
    return merged({ base: input.base, ours: shaped, theirs: input.theirs })
  } catch {
    return cloned(input.theirs)
  }
}

function besideInPlace(input: RebaseInput): PaperDocument {
  const merge = new Merge(input)
  const start = structureOnly(input, merge)
  const completed = restoreMissing(merge, start)
  return completed ? valid(completed) : start
}

function theirsWithOurEdits(input: RebaseInput): PaperDocument {
  const target = cloned(input.theirs)
  const blocks = target.blocks as unknown as Mut[]
  const ours = indexOf(input.ours)
  const base = nodesOf(indexOf(input.base))
  const used = new Set<string>([
    ...indexOf(input.theirs).keys(),
    ...ours.keys(),
  ])
  for (const [id, entry] of ours) {
    if (entry.owner === "header") continue
    const node = entry.node as unknown as Mut
    const before = base.get(id)
    if (before && sameOwn(before, node)) continue
    const extra: Mut = { ...copyOf(node), id: unusedId(used, id) }
    const found = locate(blocks, id)
    if (found) found.list.splice(found.at + 1, 0, extra)
    else blocks.push(extra)
  }
  withMergedHeader(target, input)
  return valid(target)
}

export function rebasePending(
  input: RebaseInput,
  merge: (input: RebaseInput) => PaperDocument = merged,
  keepBeside: (input: RebaseInput) => PaperDocument = besideInPlace
): {
  readonly document: PaperDocument
  readonly failed: boolean
} {
  try {
    return { document: merge(input), failed: false }
  } catch {
    try {
      return { document: keepBeside(input), failed: true }
    } catch {
      return { document: theirsWithOurEdits(input), failed: true }
    }
  }
}

function withMergedHeader(target: PaperDocument, input: RebaseInput) {
  if (target.kind !== "cv" || input.ours.kind !== "cv") return
  const base = input.base.kind === "cv" ? input.base.header : undefined
  const header = mergedFields(
    base as unknown as Mut | undefined,
    input.ours.header as unknown as Mut,
    input.theirs.kind === "cv"
      ? (input.theirs.header as unknown as Mut)
      : (input.ours.header as unknown as Mut)
  )
  target.header = { ...target.header, ...header } as never
}

function merged(input: RebaseInput): PaperDocument {
  const merge = new Merge(input)
  merge.decide()
  merge.breakCycles()
  merge.build()
  const target = cloned(input.theirs)
  const blocks = merge.assemble(input.ours.blocks as unknown as PaperNode[])
  target.blocks = blocks as never
  withMergedHeader(target, input)
  const checked = valid(target)
  const completed = restoreMissing(merge, checked)
  return completed ? valid(completed) : checked
}
