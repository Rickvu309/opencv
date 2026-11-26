import { DOMParser } from "@xmldom/xmldom/lib/dom-parser.js"

import { refuse } from "./package-errors.js"
import { PACKAGE_LIMITS } from "./package-limits.js"

export const WORD_NS =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
export const XML_NS = "http://www.w3.org/XML/1998/namespace"
export const XMLNS_NS = "http://www.w3.org/2000/xmlns/"

export type XmlAttribute = {
  name: string
  local: string
  uri: string
  value: string
  start: number
  end: number
}

export type XmlElement = {
  name: string
  local: string
  uri: string
  attributes: XmlAttribute[]
  children: XmlElement[]
  parent: XmlElement | null
  namespaces: Map<string, string>
  start: number
  openEnd: number
  closeStart: number
  end: number
  empty: boolean
  opaque: boolean
}

const entities = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["apos", "'"],
  ["quot", '"'],
])

export function xmlCharacters(text: string) {
  for (const value of text) {
    const code = value.codePointAt(0) ?? 0
    if (!(
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd) ||
      (code >= 0x10000 && code <= 0x10ffff)
    ))
      return false
  }
  return true
}

export function decodeXml(text: string, attribute = false) {
  const normalized = text.replace(/\r\n?/g, "\n")
  const literal = attribute ? normalized.replace(/[\n\t]/g, " ") : normalized
  const output = literal.replace(
    /&([^;]*);|&/g,
    (match, entity: string | undefined) => {
      if (!entity) return refuse("INVALID_XML_ENTITY", match)
      const named = entities.get(entity)
      if (named !== undefined) return named
      if (!/^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(entity))
        refuse("INVALID_XML_ENTITY")
      const point = entity.startsWith("#x")
        ? Number.parseInt(entity.slice(2), 16)
        : Number(entity.slice(1))
      if (!Number.isSafeInteger(point) || point > 0x10ffff)
        refuse("INVALID_XML_ENTITY")
      return String.fromCodePoint(point)
    }
  )
  if (!xmlCharacters(output)) refuse("INVALID_XML_CHARACTERS")
  return output
}

function qualified(name: string) {
  if (!/^[A-Za-z_][A-Za-z_0-9.-]*(?::[A-Za-z_][A-Za-z_0-9.-]*)?$/.test(name))
    refuse("UNSUPPORTED_XML_NAME")
  const colon = name.indexOf(":")
  return colon < 0
    ? { prefix: "", local: name }
    : { prefix: name.slice(0, colon), local: name.slice(colon + 1) }
}

function tagEnd(source: string, start: number) {
  let quote = ""
  for (let at = start + 1; at < source.length; at++) {
    const character = source[at]
    if (quote) {
      if (character === quote) quote = ""
    } else if (character === '"' || character === "'") quote = character
    else if (character === ">") return at + 1
    else if (character === "<") refuse("INVALID_XML_TAG")
  }
  return refuse("UNCLOSED_XML_TAG")
}

export function parsePackageXml(bytes: Uint8Array, budget = { elements: 0 }) {
  if (bytes.byteLength > PACKAGE_LIMITS.memberBytes) refuse("XML_SIZE_LIMIT")
  const source = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: true,
  }).decode(bytes)
  if (!xmlCharacters(source) || /<!DOCTYPE|<!ENTITY/i.test(source))
    refuse("UNSAFE_XML")
  const stack: XmlElement[] = []
  const roots: XmlElement[] = []
  let position = 0
  while (position < source.length) {
    const start = source.indexOf("<", position)
    const textEnd = start < 0 ? source.length : start
    const text = source.slice(position, textEnd)
    decodeXml(text)
    if (!stack.length && text.trim()) refuse("XML_OUTSIDE_ROOT")
    if (start < 0) break
    if (
      source.startsWith("<!--", start) ||
      source.startsWith("<![CDATA[", start) ||
      source.startsWith("<?", start)
    ) {
      const ending = source.startsWith("<!--", start)
        ? "-->"
        : source.startsWith("<?", start)
          ? "?>"
          : "]]>"
      const end = source.indexOf(ending, start + 2)
      if (end < 0) refuse("UNCLOSED_XML_TOKEN")
      const token = source.slice(start, end + ending.length)
      if (
        /^<\?xml\s/.test(token) &&
        !roots.length &&
        !stack.length &&
        (start === 0 || (start === 1 && source.charCodeAt(0) === 0xfeff))
      ) {
        const encoding = /encoding\s*=\s*['"]([^'"]+)['"]/.exec(token)?.[1]
        if (encoding && !/^utf-8$/i.test(encoding)) refuse("XML_ENCODING")
      } else {
        const parent = stack.at(-1)
        if (parent) parent.opaque = true
      }
      position = end + ending.length
      continue
    }
    const end = tagEnd(source, start)
    const token = source.slice(start, end)
    if (token.startsWith("</")) {
      const current = stack.pop()
      if (!current || token.slice(2, -1).trim() !== current.name)
        refuse("XML_NESTING")
      current.closeStart = start
      current.end = end
    } else {
      const name = /^<([^\s/>]+)/.exec(token)?.[1] ?? refuse("INVALID_XML_TAG")
      const parts = qualified(name)
      const parent = stack.at(-1) ?? null
      const namespaces = new Map(parent?.namespaces ?? [["xml", XML_NS]])
      const rawAttributes: Omit<XmlAttribute, "uri" | "local">[] = []
      let offset = start + 1 + name.length
      const empty = token.endsWith("/>")
      const attributesEnd = end - (empty ? 2 : 1)
      while (offset < attributesEnd) {
        const whitespace = /^[\t\n\r ]+/.exec(
          source.slice(offset, attributesEnd)
        )?.[0]
        if (!whitespace) refuse("INVALID_XML_ATTRIBUTES")
        offset += whitespace.length
        if (offset === attributesEnd) break
        const match = /^([^\s=<>]+)\s*=\s*(["'])([^<]*?)\2/.exec(
          source.slice(offset, attributesEnd)
        )
        if (!match) refuse("INVALID_XML_ATTRIBUTES")
        if (rawAttributes.length >= PACKAGE_LIMITS.xmlAttributes)
          refuse("XML_ATTRIBUTE_LIMIT")
        const attributeName = match[1]
        qualified(attributeName)
        const value = decodeXml(match[3], true)
        if (rawAttributes.some((attribute) => attribute.name === attributeName))
          refuse("DUPLICATE_XML_ATTRIBUTE")
        rawAttributes.push({
          name: attributeName,
          value,
          start: offset,
          end: offset + match[0].length,
        })
        if (attributeName === "xmlns" || attributeName.startsWith("xmlns:")) {
          const prefix = attributeName === "xmlns" ? "" : attributeName.slice(6)
          if (
            prefix === "xmlns" ||
            value === XMLNS_NS ||
            (prefix === "xml" && value !== XML_NS) ||
            (prefix !== "xml" && value === XML_NS) ||
            (prefix && !value)
          )
            refuse("INVALID_XML_NAMESPACE")
          namespaces.set(prefix, value)
        }
        offset += match[0].length
      }
      const attributes = rawAttributes.map((attribute) => {
        const split = qualified(attribute.name)
        const uri =
          attribute.name === "xmlns" || split.prefix === "xmlns"
            ? XMLNS_NS
            : split.prefix
              ? (namespaces.get(split.prefix) ?? refuse("UNBOUND_XML_PREFIX"))
              : ""
        return { ...attribute, local: split.local, uri }
      })
      if (
        new Set(
          attributes.map((attribute) => `${attribute.uri}\0${attribute.local}`)
        ).size !== attributes.length
      )
        refuse("DUPLICATE_XML_ATTRIBUTE")
      budget.elements++
      if (
        stack.length >= PACKAGE_LIMITS.xmlDepth ||
        budget.elements > PACKAGE_LIMITS.xmlElements
      )
        refuse("XML_STRUCTURE_LIMIT")
      const element: XmlElement = {
        name,
        local: parts.local,
        uri:
          namespaces.get(parts.prefix) ??
          (parts.prefix ? refuse("UNBOUND_XML_PREFIX") : ""),
        attributes,
        namespaces,
        parent,
        children: [],
        start,
        openEnd: end,
        closeStart: end,
        end,
        empty,
        opaque: false,
      }
      if (parent) parent.children.push(element)
      else roots.push(element)
      if (!empty) stack.push(element)
    }
    position = end
  }
  if (stack.length || roots.length !== 1) refuse("XML_ROOT")
  const reject = () => refuse("MALFORMED_XML")
  new DOMParser({
    errorHandler: { warning: reject, error: reject, fatalError: reject },
  }).parseFromString(source, "application/xml")
  return { source, root: roots[0] }
}

export function descendants(root: XmlElement): XmlElement[] {
  return [root, ...root.children.flatMap(descendants)]
}

export function isWord(node: XmlElement, name?: string) {
  return node.uri === WORD_NS && (name === undefined || node.local === name)
}

export function wordAttribute(node: XmlElement, name: string) {
  return node.attributes.find(
    (attribute) => attribute.uri === WORD_NS && attribute.local === name
  )?.value
}

export function wordChild(node: XmlElement, name: string) {
  return node.children.find((child) => isWord(child, name))
}
