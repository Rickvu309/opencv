import { createHash } from "node:crypto"

import type { PackageSidecar } from "./package-engine.js"
import { refuse } from "./package-errors.js"
import { W14_NS } from "./package-profile.js"
import type { ParsedPart } from "./package-references.js"
import {
  descendants,
  isWord,
  parsePackageXml,
  type XmlElement,
} from "./package-xml.js"

export function updateParagraphVersions(
  main: ParsedPart,
  source: string,
  edits: { target: { ordinal: number; paragraph: XmlElement } }[],
  sidecar: PackageSidecar,
  seed: string
) {
  const paragraphs = structuredClone(sidecar.paragraphs)
  const next = parsePackageXml(Buffer.from(source))
  const nodes = descendants(next.root).filter((node) => isWord(node, "p"))
  const replacements = new Map<number, (xml: string) => string>()
  const changes: { start: number; end: number; value: string }[] = []
  for (const ordinal of new Set(edits.map((edit) => edit.target.ordinal))) {
    const node = nodes[ordinal] ?? refuse("CANDIDATE_TEXT_OR_ENVELOPE_MISMATCH")
    const version = node.attributes.find(
      (item) => item.uri === W14_NS && item.local === "textId"
    )
    if (!version) continue
    const history = paragraphs[ordinal].textIds
    if (
      !history.includes(version.value.toUpperCase()) ||
      history.length >= 4096
    )
      refuse("PARAGRAPH_VERSION_HISTORY_MISMATCH")
    const digest = createHash("sha256")
      .update(JSON.stringify([seed, ordinal, history]))
      .digest()
    let value = digest.readUInt32BE(0) & 0x7fffffff
    const used = new Set(history)
    while (
      !value ||
      used.has(value.toString(16).toUpperCase().padStart(8, "0"))
    )
      value = (value + 1) & 0x7fffffff
    const textId = value.toString(16).toUpperCase().padStart(8, "0")
    history.push(textId)
    const original = source.slice(version.start, version.end)
    const updated = original.replace(
      /(["'])([^"']*)\1$/,
      (_, quote: string) => `${quote}${textId}${quote}`
    )
    changes.push({ start: version.start, end: version.end, value: updated })
    const oldNode = descendants(main.root).filter((item) => isWord(item, "p"))[
      ordinal
    ]
    const old =
      oldNode.attributes.find(
        (item) => item.uri === W14_NS && item.local === "textId"
      ) ?? refuse("PARAGRAPH_VERSION_HISTORY_MISMATCH")
    const start = old.start - oldNode.start
    const end = old.end - oldNode.start
    replacements.set(
      ordinal,
      (xml) => xml.slice(0, start) + updated + xml.slice(end)
    )
  }
  for (const change of changes.sort((left, right) => right.start - left.start))
    source =
      source.slice(0, change.start) + change.value + source.slice(change.end)
  return { source, paragraphs, replacements }
}
