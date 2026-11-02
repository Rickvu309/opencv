import type { _blocksToProsemirrorNode } from "@blocknote/core/yjs"
import { updateYFragment } from "y-prosemirror"
import * as Y from "yjs"

import { syncRuns, type Run } from "./ytext.js"

export type PmNode = ReturnType<typeof _blocksToProsemirrorNode>

type Meta = Parameters<typeof updateYFragment>[3]

const CONTAINER = "blockContainer"
const GROUP = "blockGroup"

function newMeta(): Meta {
  return { mapping: new Map(), isOMark: new Map() }
}

function idOf(element: unknown): string | undefined {
  if (!(element instanceof Y.XmlElement)) return undefined
  const id = element.getAttribute("id")
  return typeof id === "string" ? id : undefined
}

export function groupOf(parent: Y.XmlFragment): Y.XmlElement | null {
  const group = parent
    .toArray()
    .find((child) => child instanceof Y.XmlElement && child.nodeName === GROUP)
  return group instanceof Y.XmlElement ? group : null
}

function syncAttributes(
  element: Y.XmlElement,
  attrs: Record<string, unknown>
): void {
  const current = element.getAttributes()
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) {
      element.removeAttribute(key)
    } else if (current[key] !== value) {
      element.setAttribute(key, value as string)
    }
  }
  for (const key of Object.keys(current)) {
    if (!(key in attrs)) element.removeAttribute(key)
  }
}

function runsOf(content: PmNode): Run[] {
  const runs: Run[] = []
  content.forEach((child) => {
    if (!child.isText) return
    const attributes: Record<string, unknown> = {}
    for (const mark of child.marks) attributes[mark.type.name] = mark.attrs
    runs.push({ text: child.text ?? "", attributes })
  })
  return runs
}

function build(
  yDoc: Y.Doc,
  parent: Y.XmlElement,
  index: number,
  name: string,
  node: PmNode,
  meta: Meta
): Y.XmlElement {
  const element = new Y.XmlElement(name)
  parent.insert(index, [element])
  updateYFragment(yDoc, element, node, meta)
  return element
}

function stableIndexes(positions: readonly number[]): Set<number> {
  const best: number[] = []
  const previous: number[] = []
  positions.forEach((value, index) => {
    best[index] = 1
    previous[index] = -1
    for (let before = 0; before < index; before++) {
      const prior = positions[before]
      const length = best[before]
      if (
        prior !== undefined &&
        length !== undefined &&
        prior < value &&
        length + 1 > (best[index] ?? 0)
      ) {
        best[index] = length + 1
        previous[index] = before
      }
    }
  })
  let tail = -1
  best.forEach((length, index) => {
    if (tail === -1 || length > (best[tail] ?? 0)) tail = index
  })
  const stable = new Set<number>()
  for (let cursor = tail; cursor !== -1; cursor = previous[cursor] ?? -1) {
    stable.add(cursor)
  }
  return stable
}

function reconcileContainer(
  yDoc: Y.Doc,
  container: Y.XmlElement,
  node: PmNode,
  meta: Meta,
  moved: ReadonlySet<string>
): void {
  syncAttributes(container, node.attrs)
  const content = node.child(0)
  const current = container.get(0)
  if (
    current instanceof Y.XmlElement &&
    current.nodeName === content.type.name
  ) {
    syncAttributes(current, content.attrs)
    syncRuns(current, runsOf(content))
  } else {
    container.delete(0, 1)
    build(yDoc, container, 0, content.type.name, content, meta)
  }
  const group = groupOf(container)
  const wanted = node.childCount > 1 ? node.child(1) : null
  if (wanted && group) {
    reconcileGroup(yDoc, group, wanted, meta, moved)
  } else if (wanted) {
    build(yDoc, container, container.length, GROUP, wanted, meta)
  } else if (group) {
    const index = container.toArray().indexOf(group)
    container.delete(index, 1)
  }
}

function reconcileGroup(
  yDoc: Y.Doc,
  group: Y.XmlElement,
  node: PmNode,
  meta: Meta,
  moved: ReadonlySet<string>
): void {
  const targets: PmNode[] = []
  node.forEach((child) => targets.push(child))
  const targetIds = targets.map((target) => String(target.attrs.id))
  const where = new Map(targetIds.map((id, index) => [id, index]))

  const survivors: { index: number; at: number }[] = []
  const claimed = new Set<string>()
  group.toArray().forEach((child, index) => {
    const id = idOf(child)
    const at = id === undefined ? undefined : where.get(id)
    if (id === undefined || at === undefined || claimed.has(id)) return
    if (moved.has(id)) return
    claimed.add(id)
    survivors.push({ index, at })
  })
  const stable = stableIndexes(survivors.map((survivor) => survivor.at))
  const keep = new Set(
    survivors
      .filter((_survivor, order) => stable.has(order))
      .map((survivor) => survivor.index)
  )
  for (let index = group.length - 1; index >= 0; index--) {
    if (!keep.has(index)) group.delete(index, 1)
  }

  targets.forEach((target, index) => {
    const existing = group.get(index)
    if (
      existing instanceof Y.XmlElement &&
      idOf(existing) === targetIds[index]
    ) {
      reconcileContainer(yDoc, existing, target, meta, moved)
    } else {
      build(yDoc, group, index, CONTAINER, target, meta)
    }
  })
}

export function writeFragment(
  yDoc: Y.Doc,
  fragment: Y.XmlFragment,
  root: PmNode,
  moved: ReadonlySet<string> = new Set()
): void {
  const meta = newMeta()
  if (fragment.length === 0) {
    updateYFragment(yDoc, fragment, root, meta)
    return
  }
  const group = fragment.length === 1 ? groupOf(fragment) : null
  if (!group) throw new Error("The document does not hold exactly one root")
  reconcileGroup(yDoc, group, root.child(0), meta, moved)
}
