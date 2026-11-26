import {
  decodeXml,
  descendants,
  parsePackageXml,
  WORD_NS,
  type XmlElement,
} from "../import/package-xml.js"
import { readPackageZip } from "../import/package-zip.js"

export async function inspect(bytes: Uint8Array) {
  const { files } = await readPackageZip(bytes)
  const parts = new Map(
    [...files].map(([name, content]) => [name, parsePackageXml(content)])
  )
  return {
    names: [...files.keys()],
    part(name: string) {
      const part = parts.get(name)
      if (!part) throw new Error(`Missing test package part ${name}`)
      return part
    },
  }
}

export function elements(root: XmlElement, local: string, uri = WORD_NS) {
  return descendants(root).filter(
    (node) => node.local === local && node.uri === uri
  )
}

export function attribute(node: XmlElement, local: string, uri = WORD_NS) {
  return node.attributes.find(
    (item) => item.local === local && item.uri === uri
  )?.value
}

export function one(root: XmlElement, local: string, uri = WORD_NS) {
  const nodes = elements(root, local, uri)
  if (nodes.length !== 1)
    throw new Error(`Expected one ${local}, got ${nodes.length}`)
  const node = nodes[0]
  if (!node) throw new Error(`Missing ${local}`)
  return node
}

export function textOf(part: { source: string }, root: XmlElement): string {
  return descendants(root)
    .map((node) => {
      if (node.uri !== WORD_NS) return ""
      if (node.local === "tab") return "\t"
      if (node.local === "br") return "\n"
      if (node.local === "t")
        return decodeXml(part.source.slice(node.openEnd, node.closeStart))
      return ""
    })
    .join("")
}
