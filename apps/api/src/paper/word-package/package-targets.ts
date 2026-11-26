import {
  PaperPackageRefusal,
  refusalReason,
  type PackageRefusalReason,
} from "./package-errors.js"
import { PACKAGE_LIMITS } from "./package-limits.js"
import { OFFICE_RELATIONSHIP_NS, PACKAGE_PROFILE } from "./package-profile.js"
import type { PackageReferences, ParsedPart } from "./package-references.js"
import {
  breakRun,
  externalLink,
  ordinaryRun,
  proofingInventory,
  proofingOverlap,
  proofMarker,
  type ProofInventory,
} from "./package-neighbors.js"
import { inspectTargetPolicy } from "./package-policy.js"
import {
  decodeXml,
  descendants,
  isWord,
  wordAttribute,
  type XmlElement,
} from "./package-xml.js"

export function paragraphText(node: XmlElement, source: string): string {
  if (
    isWord(node, "del") ||
    isWord(node, "moveFrom") ||
    ["pPr", "rPr", "tcPr", "trPr", "tblPr", "sectPr"].some((name) =>
      isWord(node, name)
    )
  )
    return ""
  const inRun = node.parent !== null && isWord(node.parent, "r")
  if (isWord(node, "t"))
    return inRun && !node.empty
      ? decodeXml(source.slice(node.openEnd, node.closeStart))
      : ""
  if (isWord(node, "tab")) return inRun ? "\t" : ""
  if (isWord(node, "br") || isWord(node, "cr")) return inRun ? "\n" : ""
  return node.children
    .filter((child) => !isWord(child, "p"))
    .map((child) => paragraphText(child, source))
    .join("")
}

export type RunFormatting =
  | {
      kind: "known"
      scope: "direct-run-properties"
      properties: { name: string; values: { name: string; value: string }[] }[]
    }
  | { kind: "inherited"; scope: "preserved-uncomputed" }

type RunSpan = {
  kind: "editable"
  run: number
  text: string
  node: XmlElement
  formatting: RunFormatting
}
type LockedSpan = { kind: "locked"; text: string; reason: PackageRefusalReason }
type ParagraphPiece = RunSpan | LockedSpan
type ParagraphInspection =
  | { kind: "locked"; text: string; reason: PackageRefusalReason }
  | { kind: "pieces"; text: string; pieces: ParagraphPiece[] }

function locked(text: string, code: string): LockedSpan {
  return { kind: "locked", text, reason: refusalReason(code) }
}

function simpleLocation(node: XmlElement) {
  const parent = node.parent
  if (!parent) return false
  if (isWord(parent, "body")) return true
  const row = parent.parent
  const table = row?.parent
  const body = table?.parent
  return (
    isWord(parent, "tc") &&
    row &&
    isWord(row, "tr") &&
    table &&
    isWord(table, "tbl") &&
    body &&
    isWord(body, "body") &&
    parent.children.filter((child) => isWord(child, "p")).length === 1 &&
    parent.children.every(
      (child) => isWord(child, "p") || isWord(child, "tcPr")
    )
  )
}

function tableRevision(node: XmlElement) {
  return [node.parent, node.parent?.parent].some(
    (container) =>
      container &&
      (isWord(container, "tc") || isWord(container, "tr")) &&
      container.children.some(
        (property) =>
          (isWord(property, "tcPr") || isWord(property, "trPr")) &&
          descendants(property).some(
            (item) =>
              isWord(item) &&
              ([
                "ins",
                "del",
                "moveFrom",
                "moveTo",
                "cellIns",
                "cellDel",
                "cellMerge",
              ].includes(item.local) ||
                item.local.endsWith("Change"))
          )
      )
  )
}

function simpleProperties(node: XmlElement, name: string) {
  return (
    isWord(node, name) &&
    !node.opaque &&
    node.children.every((property) => {
      if (name === "pPr" && isWord(property, "tabs"))
        return (
          !property.opaque &&
          property.children.every(
            (tab) => isWord(tab, "tab") && !tab.opaque && !tab.children.length
          )
        )
      return (
        PACKAGE_PROFILE.propNames.has(property.local) &&
        !property.opaque &&
        descendants(property).every(
          (child) => PACKAGE_PROFILE.propNames.has(child.local) && !child.opaque
        )
      )
    })
  )
}

function inspectRun(
  run: XmlElement,
  ordinal: number,
  part: ParsedPart
): RunSpan | LockedSpan {
  const text = paragraphText(run, part.source)
  if (
    run.children.some(
      (child) => !isWord(child, "t") && !simpleProperties(child, "rPr")
    ) ||
    run.children.filter((child) => isWord(child, "rPr")).length > 1
  )
    return locked(text, "UNSUPPORTED_RUN_STRUCTURE")
  const texts = run.children.filter((child) => isWord(child, "t"))
  if (texts.length !== 1 || texts[0].children.length)
    return locked(text, "MIXED_OR_MISSING_TEXT_NODE")
  if (/[\t\n\r]/u.test(text)) return locked(text, "UNSUPPORTED_TEXT_CONTROL")
  if (!text) return locked(text, "EMPTY_TARGET")
  if (Buffer.byteLength(text, "utf8") > PACKAGE_LIMITS.targetBytes)
    return locked(text, "TARGET_TOO_LARGE")
  const direct = run.children.find((child) => isWord(child, "rPr"))
  const formatting: RunFormatting = direct
    ? {
        kind: "known",
        scope: "direct-run-properties",
        properties: direct.children.map((property) => ({
          name: property.local,
          values: property.attributes
            .filter(
              (attribute) => attribute.uri !== "http://www.w3.org/2000/xmlns/"
            )
            .map((attribute) => ({
              name: attribute.local,
              value: attribute.value,
            })),
        })),
      }
    : { kind: "inherited", scope: "preserved-uncomputed" }
  return { kind: "editable", run: ordinal, text, node: texts[0], formatting }
}

function usesUnprovenRelationship(
  node: XmlElement,
  part: ParsedPart,
  policy: PackageReferences
) {
  let owner = ""
  for (const [name, candidate] of policy.parts)
    if (candidate === part) owner = name
  if (!owner) return false
  const ids = new Set(
    policy.graph
      .filter((item) => item.unproven && item.owner === owner)
      .map((item) => item.id)
  )
  if (!ids.size) return false
  return descendants(node).some((child) =>
    child.attributes.some(
      (item) => item.uri === OFFICE_RELATIONSHIP_NS && ids.has(item.value)
    )
  )
}

const proofCache = new WeakMap<PackageReferences, ProofInventory>()

function proofInventory(policy: PackageReferences) {
  const cached = proofCache.get(policy)
  if (cached) return cached
  const inventory = proofingInventory(policy.parts)
  proofCache.set(policy, inventory)
  return inventory
}

function partName(part: ParsedPart, policy: PackageReferences) {
  for (const [name, candidate] of policy.parts)
    if (candidate === part) return name
  return ""
}

export function inspectParagraph(
  node: XmlElement,
  part: ParsedPart,
  policy: PackageReferences
): ParagraphInspection {
  const text = paragraphText(node, part.source)
  if (usesUnprovenRelationship(node, part, policy))
    return locked(text, "UNPROVEN_RELATIONSHIP")
  if (Buffer.byteLength(text, "utf8") > PACKAGE_LIMITS.targetBytes)
    return locked(text, "PARAGRAPH_CONTEXT_TOO_LARGE")
  if (tableRevision(node)) return locked(text, "TRACKED_TABLE_REVISION")
  if (!simpleLocation(node))
    return locked(text, "UNSUPPORTED_STORY_OR_ANCESTOR")
  try {
    inspectTargetPolicy(node, part, policy)
  } catch (error) {
    if (!(error instanceof PaperPackageRefusal)) throw error
    return locked(text, error.code)
  }
  const nodes = descendants(node)
  if (nodes.some((child) => child.opaque || isWord(child, "sectPr")))
    return locked(text, "OPAQUE_OR_SECTION_BOUNDARY")
  if (
    nodes.some(
      (child) =>
        isWord(child, "lang") &&
        (wordAttribute(child, "bidi") ||
          /^(?:ar|he|fa|ur|ps|syr|dv)(?:-|$)/i.test(
            wordAttribute(child, "val") ?? ""
          ))
    ) ||
    /[\u0590-\u08ff\u202a-\u202e\u2066-\u2069\ufb1d-\ufdff\ufe70-\ufeff]/u.test(
      text
    )
  )
    return locked(text, "UNSUPPORTED_BIDI")
  const inventory = proofInventory(policy)
  if (inventory.unresolved.has(node)) return locked(text, "UNRESOLVED_PROOFING")
  if (
    node.children.filter((child) => simpleProperties(child, "pPr")).length > 1
  )
    return locked(text, "UNSUPPORTED_PARAGRAPH_STRUCTURE")
  for (const child of node.children) {
    if (simpleProperties(child, "pPr") || isWord(child, "r")) continue
    if (externalLink(child, policy.graph) || proofMarker(child)) continue
    return locked(text, "UNSUPPORTED_PARAGRAPH_STRUCTURE")
  }
  const name = partName(part, policy)
  const pieces: ParagraphPiece[] = []
  let runIndex = 0
  for (const child of node.children) {
    if (simpleProperties(child, "pPr") || proofMarker(child)) continue
    if (externalLink(child, policy.graph)) {
      pieces.push(
        locked(paragraphText(child, part.source), "PRESERVED_NEIGHBOR")
      )
      continue
    }
    if (!isWord(child, "r"))
      return locked(text, "UNSUPPORTED_PARAGRAPH_STRUCTURE")
    if (breakRun(child)) {
      pieces.push(
        locked(paragraphText(child, part.source), "PRESERVED_NEIGHBOR")
      )
      runIndex += 1
      continue
    }
    const span = inspectRun(child, runIndex, part)
    if (span.kind === "locked") return locked(text, span.reason.code)
    if (!ordinaryRun(child)) return locked(text, "UNSUPPORTED_RUN_STRUCTURE")
    if (proofingOverlap(inventory, child, name))
      pieces.push(locked(span.text, "PROOFING_RANGE"))
    else pieces.push(span)
    runIndex += 1
  }
  if (!pieces.some((piece) => piece.kind === "editable")) {
    if (
      pieces.some(
        (piece) =>
          piece.kind === "locked" && piece.reason.code === "PROOFING_RANGE"
      )
    )
      return { kind: "pieces", text, pieces }
    return locked(text, "MIXED_OR_MISSING_RUN")
  }
  return { kind: "pieces", text, pieces }
}
