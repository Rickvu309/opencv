import {
  PaperPackageRefusal,
  refusalReason,
  type PackageRefusalReason,
} from "./package-errors.js"
import { PACKAGE_LIMITS } from "./package-limits.js"
import { PACKAGE_PROFILE } from "./package-profile.js"
import type { PackageReferences, ParsedPart } from "./package-references.js"
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
type ParagraphInspection =
  | { kind: "locked"; text: string; reason: PackageRefusalReason }
  | { kind: "spans"; text: string; spans: RunSpan[] }

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

export function inspectParagraph(
  node: XmlElement,
  part: ParsedPart,
  policy: PackageReferences
): ParagraphInspection {
  const text = paragraphText(node, part.source)
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
  if (
    node.children.some(
      (child) => !isWord(child, "r") && !simpleProperties(child, "pPr")
    ) ||
    node.children.filter((child) => isWord(child, "pPr")).length > 1
  )
    return locked(text, "UNSUPPORTED_PARAGRAPH_STRUCTURE")
  const runs = node.children.filter((child) => isWord(child, "r"))
  if (!runs.length) return locked(text, "MIXED_OR_MISSING_RUN")
  const spans: RunSpan[] = []
  for (const [ordinal, run] of runs.entries()) {
    const span = inspectRun(run, ordinal, part)
    if (span.kind === "locked") return locked(text, span.reason.code)
    spans.push(span)
  }
  return { kind: "spans", text, spans }
}
