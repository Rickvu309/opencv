import { posix } from "node:path"

import { refuse } from "./package-errors.js"
import {
  CONTENT_TYPE_NS,
  isNamespaceAttribute,
  MAIN_PART,
  OFFICE_RELATIONSHIP_NS,
  PACKAGE_PROFILE,
  RELATIONSHIP_NS,
  storyPart,
  W14_NS,
} from "./package-profile.js"
import { externalLink } from "./package-neighbors.js"
import {
  decodeXml,
  descendants,
  isWord,
  type parsePackageXml,
  type XmlElement,
} from "./package-xml.js"
import type { PackageZip } from "./package-zip.js"

export type ParsedPart = ReturnType<typeof parsePackageXml>
export type LockedRange = {
  part: string
  start: number
  end: number
  kind: string
}
export type PackageRelationship = {
  owner: string
  id: string
  type: string
  target: string
  mode: string
  resolved?: string
  unproven?: boolean
}
export type PackageReferences = ReturnType<typeof inspectPackageReferences>

export function attribute(
  node: XmlElement | undefined,
  name: string,
  uri = ""
) {
  return node?.attributes.find(
    (item) => item.uri === uri && item.local === name
  )?.value
}

function owner(name: string) {
  return name.toLowerCase() === "_rels/.rels"
    ? ""
    : name.replace(/\/_rels\//i, "/").slice(0, -5)
}

function declarations(
  parts: Map<string, ParsedPart>,
  files: PackageZip["files"]
) {
  const root =
    parts.get("[Content_Types].xml")?.root ?? refuse("MISSING_CONTENT_TYPES")
  if (root.uri !== CONTENT_TYPE_NS || root.local !== "Types")
    refuse("UNPROVEN_CONTENT_TYPES")
  const defaults = new Map<string, string>()
  const overrides = new Map<string, string>()
  for (const node of descendants(root)) {
    const names =
      node === root
        ? []
        : node.local === "Default"
          ? ["Extension", "ContentType"]
          : node.local === "Override"
            ? ["PartName", "ContentType"]
            : refuse("UNPROVEN_CONTENT_TYPES")
    if (
      node.uri !== CONTENT_TYPE_NS ||
      node.opaque ||
      (node !== root && (node.parent !== root || node.children.length)) ||
      node.attributes.some(
        (item) =>
          !isNamespaceAttribute(item) &&
          (item.uri || !names.includes(item.local))
      )
    )
      refuse("UNPROVEN_CONTENT_TYPES")
    if (node === root) continue
    const key = attribute(node, names[0]) ?? refuse("UNPROVEN_CONTENT_TYPES")
    const value =
      attribute(node, "ContentType") ?? refuse("UNPROVEN_CONTENT_TYPES")
    const table = node.local === "Default" ? defaults : overrides
    if (table.has(key.toLowerCase())) refuse("UNPROVEN_CONTENT_TYPES")
    table.set(key.toLowerCase(), value)
  }
  const result = new Map<string, string>()
  for (const name of files.keys()) {
    if (name === "[Content_Types].xml") continue
    const type =
      overrides.get(`/${name.toLowerCase()}`) ??
      defaults.get(
        /\.rels$/i.test(name)
          ? "rels"
          : posix.extname(name).slice(1).toLowerCase()
      ) ??
      refuse("UNPROVEN_CONTENT_TYPES")
    result.set(name, type)
  }
  const known = new Map([
    [MAIN_PART, "document.main"],
    ["word/styles.xml", "styles"],
    ["word/settings.xml", "settings"],
    ["word/numbering.xml", "numbering"],
  ])
  for (const [name, suffix] of known)
    if (
      files.has(name) &&
      result.get(name) !==
        `application/vnd.openxmlformats-officedocument.wordprocessingml.${suffix}+xml`
    )
      refuse("UNPROVEN_CONTENT_TYPES")
  return result
}

function relationships(
  parts: Map<string, ParsedPart>,
  files: PackageZip["files"]
) {
  const result: PackageRelationship[] = []
  for (const [name, part] of parts) {
    if (!/\.rels$/i.test(name)) continue
    const source = owner(name)
    if (
      (source && !files.has(source)) ||
      part.root.uri !== RELATIONSHIP_NS ||
      part.root.local !== "Relationships"
    )
      refuse("UNPROVEN_RELATIONSHIP")
    if (
      part.root.opaque ||
      part.root.attributes.some((item) => !isNamespaceAttribute(item))
    )
      refuse("UNPROVEN_RELATIONSHIP")
    const ids = new Set<string>()
    for (const node of part.root.children) {
      if (
        node.uri !== RELATIONSHIP_NS ||
        node.local !== "Relationship" ||
        node.children.length ||
        node.opaque ||
        node.attributes.some(
          (item) =>
            !isNamespaceAttribute(item) &&
            (item.uri ||
              !["Id", "Type", "Target", "TargetMode"].includes(item.local))
        )
      )
        refuse("UNPROVEN_RELATIONSHIP")
      const id = attribute(node, "Id") ?? refuse("UNPROVEN_RELATIONSHIP")
      const type = attribute(node, "Type") ?? refuse("UNPROVEN_RELATIONSHIP")
      const target =
        attribute(node, "Target") ?? refuse("UNPROVEN_RELATIONSHIP")
      const mode = attribute(node, "TargetMode") ?? "Internal"
      if (!id || ids.has(id)) refuse("UNPROVEN_RELATIONSHIP")
      ids.add(id)
      const suffix = type.startsWith(`${OFFICE_RELATIONSHIP_NS}/`)
        ? type.slice(OFFICE_RELATIONSHIP_NS.length + 1)
        : ""
      const known =
        (suffix !== "" && PACKAGE_PROFILE.relationSuffix.has(suffix)) ||
        [
          `${RELATIONSHIP_NS}/metadata/core-properties`,
          `${RELATIONSHIP_NS}/metadata/thumbnail`,
          "http://schemas.microsoft.com/office/2020/02/relationships/classificationlabels",
        ].includes(type)
      const packageRelationship =
        known &&
        [
          "officeDocument",
          "styles",
          "settings",
          "webSettings",
          "numbering",
          "fontTable",
          "theme",
          "extended-properties",
          "custom-properties",
          "customXml",
          "customXmlProps",
          "glossaryDocument",
        ].includes(suffix)
      const hyperlink = type === `${OFFICE_RELATIONSHIP_NS}/hyperlink`
      if (mode === "External") {
        if (packageRelationship) refuse("UNPROVEN_RELATIONSHIP")
        result.push(
          known && hyperlink
            ? { owner: source, id, type, target, mode }
            : { owner: source, id, type, target, mode, unproven: true }
        )
        continue
      }
      const malformed =
        mode !== "Internal" ||
        /[?#%\\]/.test(target) ||
        /^[a-z]+:/i.test(target)
      if (malformed) {
        if (known) refuse("UNPROVEN_RELATIONSHIP")
        result.push({ owner: source, id, type, target, mode, unproven: true })
        continue
      }
      const resolved = posix.normalize(
        target.startsWith("/")
          ? target.slice(1)
          : posix.join(posix.dirname(source), target)
      )
      if (resolved.startsWith("../") || !files.has(resolved)) {
        if (known) refuse("DANGLING_RELATIONSHIP")
        result.push({ owner: source, id, type, target, mode, unproven: true })
        continue
      }
      if (!known) {
        result.push({ owner: source, id, type, target, mode, unproven: true })
        continue
      }
      result.push({ owner: source, id, type, target, mode, resolved })
    }
  }
  const main = result.filter(
    (item) =>
      item.owner === "" &&
      item.type === `${OFFICE_RELATIONSHIP_NS}/officeDocument`
  )
  if (main.length !== 1 || main[0].resolved !== MAIN_PART)
    refuse("MISSING_MAIN_DOCUMENT")
  return result
}

function fieldReferences(instruction: string, references: string[]) {
  const normalized = instruction.trim()
  if (/^(?:PAGE|NUMPAGES)(?:\s+\\\*\s+MERGEFORMAT)?$/i.test(normalized)) return
  const reference =
    /^(?:REF|PAGEREF)\s+([\w.-]+)(?:\s+\\[hpnw])+$/i.exec(normalized) ??
    /^(?:REF|PAGEREF)\s+([\w.-]+)$/i.exec(normalized)
  if (reference) {
    references.push(reference[1])
    return
  }
  if (/^HYPERLINK\s+/i.test(normalized)) return
  refuse("UNPROVEN_FIELD_CONSUMER")
}

export function inspectPackageReferences(
  archive: PackageZip,
  parts: Map<string, ParsedPart>
) {
  const main = parts.get(MAIN_PART)?.root ?? refuse("MISSING_MAIN_DOCUMENT")
  if (
    !isWord(main, "document") ||
    main.children.filter((node) => isWord(node, "body")).length !== 1
  )
    refuse("MISSING_MAIN_DOCUMENT")
  for (const name of archive.files.keys())
    if (/^_xmlsignatures\/|activeX|embeddings|vbaProject|\.bin$/i.test(name))
      refuse("UNPROVEN_ACTIVE_PACKAGE")
  const types = declarations(parts, archive.files)
  const graph = relationships(parts, archive.files)
  const unprovenIds = new Map<string, Set<string>>()
  const incomingByPart = new Map<string, PackageRelationship[]>()
  const relationshipIds = new Map<string, Set<string>>()
  for (const relation of graph) {
    if (!relation.unproven) continue
    const ids = unprovenIds.get(relation.owner) ?? new Set<string>()
    ids.add(relation.id)
    unprovenIds.set(relation.owner, ids)
  }
  for (const relation of graph) {
    const ids = relationshipIds.get(relation.owner) ?? new Set<string>()
    ids.add(relation.id)
    relationshipIds.set(relation.owner, ids)
    if (relation.resolved) {
      const incoming = incomingByPart.get(relation.resolved) ?? []
      incoming.push(relation)
      incomingByPart.set(relation.resolved, incoming)
    }
  }
  const paragraphIds = new Map<ParsedPart, Map<string, number>>()
  const partNodes = new Map<ParsedPart, XmlElement[]>()
  const ranges: LockedRange[] = []
  const bookmarks = new Set<string>()
  const references: string[] = []
  const comments = new Set<string>()
  const commentReferences: string[] = []
  const identityValues = new Set<string>()
  const customStores = new Set<string>()
  for (const item of graph.filter(
    (item) => item.type === `${OFFICE_RELATIONSHIP_NS}/customXmlProps`
  )) {
    const root = item.resolved && parts.get(item.resolved)?.root
    const id =
      root &&
      attribute(
        root,
        "itemID",
        "http://schemas.openxmlformats.org/officeDocument/2006/customXml"
      )
    if (
      !root ||
      root.local !== "datastoreItem" ||
      !id ||
      customStores.has(id.toUpperCase())
    )
      refuse("UNPROVEN_BINDING_REACH")
    customStores.add(id.toUpperCase())
  }
  for (const [name, part] of parts) {
    const incoming = incomingByPart.get(name) ?? []
    const role =
      storyPart(name) ||
      [
        "[Content_Types].xml",
        "word/styles.xml",
        "word/settings.xml",
        "word/webSettings.xml",
        "word/numbering.xml",
        "word/fontTable.xml",
        "word/theme/theme1.xml",
        "docProps/core.xml",
        "docProps/app.xml",
        "docProps/custom.xml",
        "docMetadata/LabelInfo.xml",
      ].includes(name) ||
      /\.rels$/i.test(name) ||
      (/^customXml\//.test(name) &&
        incoming.some((item) =>
          /\/(customXml|customXmlProps)$/.test(item.type)
        ))
    if (!role && incoming.length) refuse("UNPROVEN_PART")
    if (/commentsExtended|commentsIds|people\.xml/.test(name))
      refuse("UNPROVEN_IDENTITY_REACH")
    const nodes = descendants(part.root)
    partNodes.set(part, nodes)
    const counts = new Map<string, number>()
    paragraphIds.set(part, counts)
    for (const node of nodes) {
      if (isWord(node, "p")) {
        const id = attribute(node, "paraId", W14_NS)?.toUpperCase()
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      if (isWord(node, "comment") && name === "word/comments.xml") {
        const id = attribute(node, "id", node.uri) ?? refuse("DANGLING_COMMENT")
        if (comments.has(id)) refuse("DANGLING_COMMENT")
        comments.add(id)
      }
      if (
        isWord(node) &&
        ["commentReference", "commentRangeStart", "commentRangeEnd"].includes(
          node.local
        )
      )
        commentReferences.push(
          attribute(node, "id", node.uri) ?? refuse("DANGLING_COMMENT")
        )
      for (const item of node.attributes) {
        if (
          item.uri === OFFICE_RELATIONSHIP_NS &&
          !relationshipIds.get(name)?.has(item.value)
        )
          refuse("DANGLING_RELATIONSHIP")
        if (
          item.uri === OFFICE_RELATIONSHIP_NS &&
          unprovenIds.get(name)?.has(item.value)
        ) {
          let cursor: XmlElement | null = node
          let inside = false
          while (cursor) {
            if (isWord(cursor, "p")) {
              inside = true
              break
            }
            cursor = cursor.parent
          }
          if (!inside) refuse("UNPROVEN_RELATIONSHIP")
        }
        if (
          /paraId|textId|paragraphId|textRef|paraRef/i.test(item.local) &&
          !(
            isWord(node, "p") &&
            item.uri === W14_NS &&
            ["paraId", "textId"].includes(item.local)
          ) &&
          !(
            isWord(node, "tr") &&
            item.uri === W14_NS &&
            ["paraId", "textId"].includes(item.local)
          )
        )
          identityValues.add(item.value.toUpperCase())
      }
      if (
        !role &&
        (isWord(node) ||
          node.attributes.some(
            (item) =>
              item.uri === OFFICE_RELATIONSHIP_NS ||
              /paraId|textId|textRef|paraRef|binding|xpath/i.test(item.local)
          ))
      )
        refuse("UNPROVEN_PART")
      if (
        isWord(node, "tr") &&
        node.attributes.some(
          (item) =>
            item.uri === W14_NS && ["paraId", "textId"].includes(item.local)
        )
      )
        ranges.push({
          part: name,
          start: node.start,
          end: node.end,
          kind: "row-version",
        })
      if (isWord(node, "dataBinding")) {
        let container = node.parent
        while (container && !isWord(container, "sdt"))
          container = container.parent
        const store = attribute(node, "storeItemID", node.uri)
        if (
          !container ||
          !store ||
          !customStores.has(store.toUpperCase()) ||
          !attribute(node, "xpath", node.uri)
        )
          refuse("UNPROVEN_BINDING_REACH")
        ranges.push({
          part: name,
          start: container.start,
          end: container.end,
          kind: "data-binding",
        })
      }
    }
    if (storyPart(name))
      storyRanges(name, part, ranges, bookmarks, references, graph)
  }
  for (const id of commentReferences)
    if (!comments.has(id)) refuse("DANGLING_COMMENT")
  for (const name of references)
    if (!bookmarks.has(name)) refuse("DANGLING_BOOKMARK")
  for (const [name] of archive.files)
    if (!parts.has(name)) {
      const incoming = incomingByPart.get(name) ?? []
      if (incoming.some((item) => !/\/(image|font|thumbnail)$/.test(item.type)))
        refuse("UNPROVEN_PART")
    }
  const rangeTargets = new WeakSet<XmlElement>()
  for (const [name, part] of parts) {
    const merged: { start: number; end: number }[] = []
    for (const range of ranges
      .filter((range) => range.part === name)
      .sort((a, b) => a.start - b.start)) {
      const last = merged.at(-1)
      if (last && range.start <= last.end)
        last.end = Math.max(last.end, range.end)
      else merged.push({ start: range.start, end: range.end })
    }
    for (const node of partNodes.get(part) ?? []) {
      if (!isWord(node, "p")) continue
      let low = 0
      let high = merged.length
      while (low < high) {
        const middle = Math.floor((low + high) / 2)
        if (merged[middle].end <= node.start) low = middle + 1
        else high = middle
      }
      if (merged[low] && merged[low].start < node.end) rangeTargets.add(node)
    }
  }
  return {
    graph,
    ranges,
    types,
    parts,
    paragraphIds,
    identityValues,
    rangeTargets,
  }
}

function storyRanges(
  name: string,
  part: ParsedPart,
  ranges: LockedRange[],
  bookmarks: Set<string>,
  references: string[],
  graph: PackageRelationship[]
) {
  const active = new Map<string, XmlElement>()
  const fields: { node: XmlElement; instruction: string }[] = []
  for (const node of descendants(part.root)) {
    const edge =
      /^(bookmark|commentRange|moveFromRange|moveToRange|perm|customXml(?:Ins|Del|MoveFrom|MoveTo)Range)(Start|End)$/.exec(
        node.local
      )
    if (isWord(node) && edge) {
      const id = attribute(node, "id", node.uri) ?? refuse("UNBALANCED_RANGE")
      const key = `${edge[1]}:${id}`
      if (edge[2] === "Start") {
        if (active.has(key)) refuse("UNBALANCED_RANGE")
        active.set(key, node)
        if (edge[1] === "bookmark") {
          const bookmark =
            attribute(node, "name", node.uri) ?? refuse("UNBALANCED_RANGE")
          if (bookmarks.has(bookmark)) refuse("UNBALANCED_RANGE")
          bookmarks.add(bookmark)
        }
      } else {
        const start = active.get(key) ?? refuse("UNBALANCED_RANGE")
        ranges.push({
          part: name,
          start: start.start,
          end: node.end,
          kind: edge[1],
        })
        active.delete(key)
      }
    }
    if (isWord(node, "fldChar")) {
      const type = attribute(node, "fldCharType", node.uri)
      if (type === "begin") fields.push({ node, instruction: "" })
      else if (type === "end") {
        const start = fields.pop() ?? refuse("UNBALANCED_FIELD")
        fieldReferences(start.instruction, references)
        ranges.push({
          part: name,
          start: start.node.start,
          end: node.end,
          kind: "field",
        })
      } else if (type !== "separate" || !fields.length)
        refuse("UNBALANCED_FIELD")
    }
    if (isWord(node, "instrText")) {
      const field = fields.at(-1) ?? refuse("UNBALANCED_FIELD")
      field.instruction += decodeXml(
        part.source.slice(node.openEnd, node.closeStart)
      )
    }
    if (isWord(node, "fldSimple")) {
      fieldReferences(attribute(node, "instr", node.uri) ?? "", references)
      ranges.push({
        part: name,
        start: node.start,
        end: node.end,
        kind: "field",
      })
    }
    if (isWord(node, "hyperlink")) {
      const anchor = attribute(node, "anchor", node.uri)
      if (anchor) references.push(anchor)
      if (!externalLink(node, graph))
        ranges.push({
          part: name,
          start: node.start,
          end: node.end,
          kind: "link",
        })
    }
  }
  if (active.size || fields.length) refuse("UNBALANCED_RANGE_OR_FIELD")
}
