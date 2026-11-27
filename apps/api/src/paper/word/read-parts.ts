import { createHash } from "node:crypto"
import { posix } from "node:path"

import { parseFileId, type FileId } from "@workspace/domain/kernel"

import { parsePackageXml, type XmlElement } from "../import/package-xml.js"
import { readPackageZip } from "../import/package-zip.js"
import { officeRelationships } from "./word-xml.js"
import type { WordFiles } from "./write-docx.js"

const packageRelationships =
  "http://schemas.openxmlformats.org/package/2006/relationships"

export function attribute(
  node: XmlElement | undefined,
  local: string,
  uri = ""
) {
  return node?.attributes.find(
    (item) => item.local === local && item.uri === uri
  )?.value
}

function relationships(root: XmlElement | undefined) {
  const links = new Map<
    string,
    { kind: string; target: string; external: boolean }
  >()
  for (const node of root?.children ?? []) {
    if (node.uri !== packageRelationships || node.local !== "Relationship")
      continue
    const id = attribute(node, "Id")
    const type = attribute(node, "Type")
    const target = attribute(node, "Target")
    if (!id || !type?.startsWith(`${officeRelationships}/`) || !target) continue
    if (links.has(id)) throw new Error("Duplicate Word relationship")
    links.set(id, {
      kind: type.slice(officeRelationships.length + 1),
      target,
      external: attribute(node, "TargetMode") === "External",
    })
  }
  return links
}

function address(from: string, target: string) {
  if (target.includes("\0") || /[\\%:?#]/u.test(target)) return undefined
  const path = target.startsWith("/")
    ? posix.normalize(target.slice(1))
    : posix.join(posix.dirname(from), target)
  return path === ".." || path.startsWith("../") ? undefined : path
}

type WordFile = NonNullable<ReturnType<WordFiles["get"]>>

function imageType(bytes: Buffer): WordFile["mediaType"] | undefined {
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")))
    return "image/png"
  if (bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex")))
    return "image/jpeg"
  const header = bytes.toString("latin1", 0, 6)
  if (header === "GIF87a" || header === "GIF89a") return "image/gif"
  if (header.startsWith("RIFF") && bytes.toString("latin1", 8, 12) === "WEBP")
    return "image/webp"
  return undefined
}

function imageId(bytes: Buffer): FileId {
  const hash = createHash("sha256").update(bytes).digest("hex")
  return parseFileId(
    `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`
  )
}

export async function readParts(bytes: Uint8Array) {
  const archive = await readPackageZip(bytes)
  const budget = { elements: 0 }
  function xml(path: string | undefined) {
    const file = path && archive.files.get(path)
    return file ? parsePackageXml(file, budget) : undefined
  }

  const rootLinks = relationships(xml("_rels/.rels")?.root)
  const main = Array.from(rootLinks.values()).find(
    (link) => link.kind === "officeDocument"
  )
  if (main?.external) throw new Error("The Word document part is external")
  const path = main ? address("", main.target) : "word/document.xml"
  if (!path) throw new Error("The Word file has no document part")
  const part = path
  const document = xml(part)
  if (!document) throw new Error("The Word file has no document part")

  const relPart = posix.join(
    posix.dirname(part),
    "_rels",
    `${posix.basename(part)}.rels`
  )
  const links = relationships(xml(relPart)?.root)
  function partFor(kind: string, defaultName: string) {
    const relation = Array.from(links.values()).find(
      (link) => link.kind === kind
    )
    if (!relation) return xml(posix.join(posix.dirname(part), defaultName))
    return relation.external ? undefined : xml(address(part, relation.target))
  }

  const files = new Map<FileId, WordFile>()
  const images = new Map<string, FileId | undefined>()
  function image(id: string) {
    const link = links.get(id)
    if (link?.kind !== "image" || link.external) return undefined
    const path = address(part, link.target)
    if (!path) return undefined
    if (images.has(path)) return images.get(path)
    const bytes = archive.files.get(path)
    const mediaType = bytes && imageType(bytes)
    const fileId = bytes && mediaType ? imageId(bytes) : undefined
    if (fileId && bytes && mediaType) files.set(fileId, { bytes, mediaType })
    images.set(path, fileId)
    return fileId
  }

  return {
    document,
    styles: partFor("styles", "styles.xml")?.root,
    numbering: partFor("numbering", "numbering.xml")?.root,
    image,
    links,
    files,
  }
}
