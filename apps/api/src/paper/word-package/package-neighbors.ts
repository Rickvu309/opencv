import {
  isNamespaceAttribute,
  MAIN_PART,
  OFFICE_RELATIONSHIP_NS,
} from "./package-profile.js"
import {
  descendants,
  isWord,
  WORD_NS,
  wordAttribute,
  type XmlElement,
} from "./package-xml.js"

export type NeighborRelation = {
  owner: string
  id: string
  type: string
  mode: string
}

const HISTORY = new Set(["0", "1", "true", "false", "on", "off"])
const PROOF_TYPES = new Set(["gramStart", "gramEnd", "spellStart", "spellEnd"])

export function ordinaryRun(node: XmlElement) {
  if (!isWord(node, "r") || node.opaque) return false
  const texts = node.children.filter((child) => isWord(child, "t"))
  if (texts.length !== 1) return false
  const text = texts[0]
  if (!text || text.empty || text.opaque || text.children.length) return false
  return node.children.every((child) => child === text || isWord(child, "rPr"))
}

function lineBreak(node: XmlElement) {
  return (
    isWord(node, "br") &&
    !node.children.length &&
    !node.opaque &&
    node.attributes.every(isNamespaceAttribute)
  )
}

export function breakRun(node: XmlElement) {
  if (!isWord(node, "r") || node.opaque) return false
  const breaks = node.children.filter(lineBreak)
  return (
    breaks.length === 1 &&
    node.children.every((child) => isWord(child, "rPr") || lineBreak(child))
  )
}

export function externalLink(
  node: XmlElement,
  relations: readonly NeighborRelation[]
) {
  if (!isWord(node, "hyperlink") || node.opaque || !node.children.length)
    return false
  if (!node.children.every(ordinaryRun)) return false
  const id = node.attributes.find(
    (item) => item.uri === OFFICE_RELATIONSHIP_NS && item.local === "id"
  )?.value
  if (
    !id ||
    !node.attributes.every(
      (item) =>
        isNamespaceAttribute(item) ||
        (item.uri === OFFICE_RELATIONSHIP_NS && item.local === "id") ||
        (item.uri === WORD_NS &&
          item.local === "history" &&
          HISTORY.has(item.value))
    )
  )
    return false
  return (
    relations.filter(
      (item) =>
        item.owner === MAIN_PART &&
        item.id === id &&
        item.type === `${OFFICE_RELATIONSHIP_NS}/hyperlink` &&
        item.mode === "External"
    ).length === 1
  )
}

export function proofMarker(node: XmlElement) {
  if (
    !isWord(node, "proofErr") ||
    node.opaque ||
    node.children.length ||
    node.attributes.filter(
      (item) => item.uri === WORD_NS && item.local === "type"
    ).length !== 1
  )
    return false
  const type = wordAttribute(node, "type")
  return (
    type !== undefined &&
    PROOF_TYPES.has(type) &&
    node.attributes.every(
      (item) =>
        isNamespaceAttribute(item) ||
        (item.uri === WORD_NS && item.local === "type")
    )
  )
}

export function preservedNeighbor(
  node: XmlElement,
  relations: readonly NeighborRelation[]
) {
  return (
    (proofMarker(node) && node.parent !== null && isWord(node.parent, "p")) ||
    externalLink(node, relations) ||
    (lineBreak(node) && node.parent !== null && breakRun(node.parent))
  )
}

export type ProofRange = {
  part: string
  start: number
  end: number
}

export type ProofInventory = {
  ranges: ProofRange[]
  unresolved: WeakSet<XmlElement>
}

function markParagraph(node: XmlElement, unresolved: WeakSet<XmlElement>) {
  let cursor: XmlElement | null = node
  while (cursor) {
    if (isWord(cursor, "p")) {
      unresolved.add(cursor)
      return
    }
    cursor = cursor.parent
  }
}

export function proofingInventory(
  parts: Iterable<[string, { root: XmlElement }]>
): ProofInventory {
  const ranges: ProofRange[] = []
  const unresolved = new WeakSet<XmlElement>()
  for (const [part, parsed] of parts) {
    const open = new Map<string, XmlElement>()
    const markers = descendants(parsed.root)
      .filter((node) => isWord(node, "proofErr"))
      .sort((left, right) => left.start - right.start)
    for (const marker of markers) {
      if (
        !proofMarker(marker) ||
        marker.parent === null ||
        !isWord(marker.parent, "p")
      ) {
        markParagraph(marker, unresolved)
        continue
      }
      const type = wordAttribute(marker, "type") ?? ""
      const kind = type.startsWith("gram") ? "gram" : "spell"
      if (type.endsWith("Start")) {
        const previous = open.get(kind)
        if (previous) {
          markParagraph(previous, unresolved)
          markParagraph(marker, unresolved)
        } else open.set(kind, marker)
        continue
      }
      const start = open.get(kind)
      if (!start) {
        markParagraph(marker, unresolved)
        continue
      }
      open.delete(kind)
      if (start.parent !== marker.parent) {
        markParagraph(start, unresolved)
        markParagraph(marker, unresolved)
        continue
      }
      ranges.push({ part, start: start.end, end: marker.start })
    }
    for (const start of open.values()) markParagraph(start, unresolved)
  }
  return { ranges, unresolved }
}

export function proofingOverlap(
  inventory: ProofInventory,
  run: XmlElement,
  part: string
) {
  return inventory.ranges.some(
    (range) =>
      range.part === part && range.start < run.end && run.start < range.end
  )
}
