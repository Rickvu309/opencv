import { createHash, randomUUID } from "node:crypto"
import { z } from "zod"

import {
  PaperPackageRefusal,
  refusalReason,
  refuse,
  type PackageRefusalReason,
} from "./package-errors.js"
import { PACKAGE_LIMITS } from "./package-limits.js"
import { MAIN_PART, PACKAGE_PROFILE } from "./package-profile.js"
import {
  inspectPackageReferences,
  type ParsedPart,
} from "./package-references.js"
import { inspectPackagePolicy } from "./package-policy.js"
import { changedInterval, replaceUniqueSpan } from "./package-spans.js"
import { updateParagraphVersions } from "./package-versions.js"
import {
  inspectParagraph,
  paragraphText,
  type RunFormatting,
} from "./package-targets.js"
import {
  decodeXml,
  descendants,
  isWord,
  parsePackageXml,
  xmlCharacters,
  XML_NS,
  xmlText,
  type XmlElement,
} from "./package-xml.js"
import {
  readPackageZip,
  replaceZipMember,
  type PackageZip,
} from "./package-zip.js"

const identity = z.string().min(1).max(256)
const contextSchema = z
  .object({ docId: identity, incarnation: identity, revision: identity })
  .strict()
const sidecarSchema = z
  .object({
    version: z.literal(2),
    profile: z.literal(PACKAGE_PROFILE.version),
    revision: identity,
    docId: identity,
    incarnation: identity,
    packageHash: z.string().regex(/^[a-f0-9]{64}$/),
    paragraphs: z
      .array(
        z
          .object({
            key: z.string().uuid(),
            ordinal: z.number().int().nonnegative(),
            textIds: z
              .array(z.string().regex(/^[0-7][a-fA-F0-9]{7}$/))
              .max(4096),
          })
          .strict()
      )
      .max(PACKAGE_LIMITS.xmlElements),
  })
  .strict()
const replacementSchema = z
  .object({
    op: z.literal("replaceText"),
    targetId: z.string().regex(/^t_[a-f0-9]{64}$/),
    before: z.string().min(1).max(PACKAGE_LIMITS.targetBytes),
    after: z.string().max(PACKAGE_LIMITS.targetBytes),
  })
  .strict()
const editSchema = z
  .object({
    docId: identity,
    basedOn: identity,
    edits: z.array(replacementSchema).min(1).max(PACKAGE_LIMITS.replacements),
  })
  .strict()

export type PackageContext = z.infer<typeof contextSchema>
export type PackageSidecar = z.infer<typeof sidecarSchema>
type Target = {
  ordinal: number
  run: number
  paragraph: XmlElement
  node: XmlElement
  text: string
}
type Location = { paragraph: number; kind: "table-cell" | "paragraph" }
type Region =
  | {
      kind: "locked"
      text: string
      location: Location
      reason: PackageRefusalReason
      complete: true
    }
  | {
      kind: "editable"
      targetId: string
      text: string
      location: Location
      formatting: RunFormatting
      context: { paragraphText: string }
    }

function hash(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex")
}

function replacementText(source: string, node: XmlElement, after: string) {
  const raw = source.slice(node.openEnd, node.closeStart)
  const interval = changedInterval(decodeXml(raw), after)
  const bounds = new Map([[0, 0]])
  let decodedLength = 0
  for (const match of raw.matchAll(/&[^;]+;|\r\n?|[\s\S]/gu)) {
    decodedLength += decodeXml(match[0]).length
    bounds.set(decodedLength, match.index + match[0].length)
  }
  const start =
    bounds.get(interval.start) ?? refuse("CANDIDATE_TEXT_OR_ENVELOPE_MISMATCH")
  const end =
    bounds.get(interval.end) ?? refuse("CANDIDATE_TEXT_OR_ENVELOPE_MISMATCH")
  return raw.slice(0, start) + xmlText(interval.replacement) + raw.slice(end)
}

function replacementXml(source: string, node: XmlElement, after: string) {
  let header = source.slice(node.start, node.openEnd)
  if (after.startsWith(" ") || after.endsWith(" ")) {
    const space = node.attributes.find(
      (attribute) => attribute.uri === XML_NS && attribute.local === "space"
    )
    if (space) {
      header =
        header.slice(0, space.start - node.start) +
        'xml:space="preserve"' +
        header.slice(space.end - node.start)
    } else {
      const at = header.length - (node.empty ? 2 : 1)
      header = header.slice(0, at) + ' xml:space="preserve"' + header.slice(at)
    }
  }
  if (node.empty)
    return header.slice(0, -2) + ">" + xmlText(after) + `</${node.name}>`
  return (
    header +
    replacementText(source, node, after) +
    source.slice(node.closeStart, node.end)
  )
}

function project(
  main: ParsedPart,
  context: PackageContext,
  sidecar: PackageSidecar,
  policy: ReturnType<typeof inspectPackageReferences> | string
) {
  const targets = new Map<string, Target>()
  const paragraphs = descendants(main.root).filter((node) => isWord(node, "p"))
  const regions: Region[] = paragraphs.flatMap(
    (paragraph, ordinal): Region[] => {
      const location: Location = {
        paragraph: ordinal + 1,
        kind:
          paragraph.parent && isWord(paragraph.parent, "tc")
            ? "table-cell"
            : "paragraph",
      }
      if (typeof policy === "string")
        return [
          {
            kind: "locked",
            text: paragraphText(paragraph, main.source),
            location,
            reason: refusalReason(policy),
            complete: true,
          },
        ]
      const inspected = inspectParagraph(paragraph, main, policy)
      if (inspected.kind === "locked")
        return [
          {
            kind: "locked",
            text: inspected.text,
            location,
            reason: inspected.reason,
            complete: true,
          },
        ]
      const key =
        sidecar.paragraphs[ordinal]?.key ?? refuse("SIDECAR_MAPPING_MISMATCH")
      return inspected.pieces.map((piece): Region => {
        if (piece.kind === "locked")
          return {
            kind: "locked",
            text: piece.text,
            location,
            reason: piece.reason,
            complete: true,
          }
        const targetId = `t_${hash(JSON.stringify([context.docId, context.incarnation, context.revision, key, piece.run, sidecar.packageHash, PACKAGE_PROFILE.version]))}`
        targets.set(targetId, {
          ordinal,
          run: piece.run,
          paragraph,
          node: piece.node,
          text: piece.text,
        })
        return {
          kind: "editable",
          targetId,
          text: piece.text,
          location,
          formatting: piece.formatting,
          context: { paragraphText: inspected.text },
        }
      })
    }
  )
  return {
    targets,
    projection: { ...context, profile: PACKAGE_PROFILE.version, regions },
  }
}

export class PaperPackage {
  readonly #archive: PackageZip
  readonly #context: PackageContext
  readonly #sidecar: PackageSidecar
  readonly #main: ParsedPart
  readonly #parts: Map<string, ParsedPart>
  readonly #policy: ReturnType<typeof inspectPackageReferences> | string
  readonly #view: ReturnType<typeof project>

  private constructor(
    archive: PackageZip,
    context: PackageContext,
    sidecar: PackageSidecar,
    parts: Map<string, ParsedPart>,
    policy: ReturnType<typeof inspectPackageReferences> | string
  ) {
    this.#archive = archive
    this.#context = context
    this.#sidecar = sidecar
    this.#parts = parts
    this.#main = parts.get(MAIN_PART) ?? refuse("MISSING_MAIN_DOCUMENT")
    this.#policy = policy
    this.#view = project(this.#main, context, sidecar, policy)
  }

  static async open(
    input: Uint8Array,
    identity: PackageContext,
    retainedSidecar?: unknown
  ) {
    const context = contextSchema.parse(identity)
    if (
      retainedSidecar !== undefined &&
      Buffer.byteLength(JSON.stringify(retainedSidecar), "utf8") >
        PACKAGE_LIMITS.memberBytes
    )
      refuse("SIDECAR_MAPPING_MISMATCH")
    const archive = await readPackageZip(input)
    const parts = new Map<string, ParsedPart>()
    const budget = { elements: 0 }
    for (const [name, bytes] of archive.files) {
      if (/\.(xml|rels)$/i.test(name))
        parts.set(name, parsePackageXml(bytes, budget))
    }
    const main = parts.get(MAIN_PART) ?? refuse("MISSING_MAIN_DOCUMENT")
    const paragraphs = descendants(main.root).filter((node) =>
      isWord(node, "p")
    )
    const packageHash = hash(archive.bytes)
    const sidecar =
      retainedSidecar === undefined
        ? sidecarSchema.parse({
            version: 2,
            profile: PACKAGE_PROFILE.version,
            revision: context.revision,
            docId: context.docId,
            incarnation: context.incarnation,
            packageHash,
            paragraphs: paragraphs.map((_, ordinal) => ({
              ordinal,
              key: randomUUID(),
              textIds: paragraphVersion(paragraphs[ordinal]),
            })),
          })
        : sidecarSchema.parse(retainedSidecar)
    if (
      sidecar.revision !== context.revision ||
      sidecar.docId !== context.docId ||
      sidecar.incarnation !== context.incarnation ||
      sidecar.packageHash !== packageHash ||
      sidecar.paragraphs.length !== paragraphs.length ||
      new Set(sidecar.paragraphs.map((paragraph) => paragraph.key)).size !==
        paragraphs.length ||
      sidecar.paragraphs.some(
        (paragraph, ordinal) =>
          paragraph.ordinal !== ordinal ||
          paragraphVersion(paragraphs[ordinal]).some(
            (value) => !paragraph.textIds.includes(value)
          ) ||
          new Set(paragraph.textIds).size !== paragraph.textIds.length
      )
    )
      refuse("SIDECAR_MAPPING_MISMATCH")
    let policy: ReturnType<typeof inspectPackageReferences> | string
    try {
      policy = inspectPackageReferences(archive, parts)
      inspectPackagePolicy(policy)
    } catch (error) {
      if (!(error instanceof PaperPackageRefusal)) throw error
      policy = error.code
    }
    return new PaperPackage(archive, context, sidecar, parts, policy)
  }

  read() {
    return structuredClone(this.#view.projection)
  }

  sidecar() {
    return structuredClone(this.#sidecar)
  }

  export() {
    return Buffer.from(this.#archive.bytes)
  }

  async prepare(input: unknown) {
    const request = editSchema.parse(input)
    if (
      Buffer.byteLength(JSON.stringify(request), "utf8") >
      PACKAGE_LIMITS.requestBytes
    )
      refuse("EDIT_REQUEST_LIMIT")
    if (
      request.docId !== this.#context.docId ||
      request.basedOn !== this.#context.revision
    )
      refuse("STALE_OR_FOREIGN_BASIS")
    if (typeof this.#policy === "string")
      refuse("READ_ONLY_PACKAGE", this.#policy)
    const ids = new Set<string>()
    let aggregate = 0
    const replacements = request.edits.map((edit) => {
      if (ids.has(edit.targetId)) refuse("DUPLICATE_TARGET")
      ids.add(edit.targetId)
      const target =
        this.#view.targets.get(edit.targetId) ??
        refuse("STALE_OR_FOREIGN_TARGET")
      if (!xmlCharacters(edit.before)) refuse("UNSUPPORTED_REPLACEMENT_TEXT")
      const replacement = replaceUniqueSpan(
        target.text,
        edit.before,
        edit.after
      )
      if (!xmlCharacters(edit.after) || /[\r\n\t]/.test(edit.after))
        refuse("UNSUPPORTED_REPLACEMENT_TEXT")
      const beforeBytes = Buffer.byteLength(edit.before, "utf8")
      const afterBytes = Buffer.byteLength(edit.after, "utf8")
      aggregate += beforeBytes + afterBytes
      if (
        Math.max(beforeBytes, afterBytes) > PACKAGE_LIMITS.targetBytes ||
        aggregate > PACKAGE_LIMITS.replacementBytes
      )
        refuse("EDIT_TEXT_LIMIT")
      return { ...edit, target, replacement }
    })
    const changed = replacements.filter(
      (replacement) => replacement.before !== replacement.after
    )
    if (!changed.length) return { package: this, changes: [] }
    let source = this.#main.source
    for (const replacement of [...changed].sort(
      (left, right) => right.target.node.start - left.target.node.start
    )) {
      const node = replacement.target.node
      source =
        source.slice(0, node.start) +
        replacementXml(this.#main.source, node, replacement.replacement) +
        source.slice(node.end)
    }
    const versioned = updateParagraphVersions(
      this.#main,
      source,
      changed,
      this.#sidecar,
      hash(JSON.stringify([this.#context, request]))
    )
    source = versioned.source
    const bytes = replaceZipMember(
      this.#archive,
      MAIN_PART,
      Buffer.from(source, "utf8")
    )
    const candidate = await PaperPackage.open(
      bytes,
      {
        ...this.#context,
        revision: hash(
          JSON.stringify([
            this.#context.revision,
            hash(bytes),
            versioned.paragraphs,
          ])
        ),
      },
      {
        ...this.#sidecar,
        revision: hash(
          JSON.stringify([
            this.#context.revision,
            hash(bytes),
            versioned.paragraphs,
          ])
        ),
        paragraphs: versioned.paragraphs,
        packageHash: hash(bytes),
      }
    )
    if (
      typeof candidate.#policy === "string" ||
      JSON.stringify(candidate.#policy.graph) !==
        JSON.stringify(this.#policy.graph)
    )
      refuse("CANDIDATE_REFERENCE_MISMATCH")
    for (const [name, original] of this.#archive.files) {
      if (
        name !== MAIN_PART &&
        !original.equals(candidate.#archive.files.get(name) ?? Buffer.alloc(0))
      )
        refuse("UNTOUCHED_PART_CHANGED")
    }
    const next = descendants(candidate.#main.root).filter((node) =>
      isWord(node, "p")
    )
    const before = descendants(this.#main.root).filter((node) =>
      isWord(node, "p")
    )
    if (next.length !== before.length)
      refuse("CANDIDATE_TEXT_OR_ENVELOPE_MISMATCH")
    const editable = new Map(
      [...candidate.#view.targets.values()].map((target) => [
        `${target.ordinal}:${target.run}`,
        target,
      ])
    )
    for (let ordinal = 0; ordinal < before.length; ordinal++) {
      const edits = changed.filter(
        (replacement) => replacement.target.ordinal === ordinal
      )
      for (const edit of edits) {
        const run = next[ordinal].children.filter((node) => isWord(node, "r"))[
          edit.target.run
        ]
        if (
          !run ||
          paragraphText(run, candidate.#main.source) !== edit.replacement ||
          (edit.replacement && !editable.has(`${ordinal}:${edit.target.run}`))
        )
          refuse("CANDIDATE_TEXT_OR_ENVELOPE_MISMATCH")
      }
      let expected = replacementParagraph(
        this.#main.source,
        before[ordinal],
        edits.map((edit) => ({
          node: edit.target.node,
          after: edit.replacement,
        }))
      )
      expected = versioned.replacements.get(ordinal)?.(expected) ?? expected
      if (
        candidate.#main.source.slice(next[ordinal].start, next[ordinal].end) !==
        expected
      )
        refuse("CANDIDATE_TEXT_OR_ENVELOPE_MISMATCH")
    }
    for (const [name, part] of this.#parts)
      if (
        name !== MAIN_PART &&
        part.source !== candidate.#parts.get(name)?.source
      )
        refuse("UNTOUCHED_XML_CHANGED")
    return {
      package: candidate,
      changes: changed.map(({ targetId, before, after }) => ({
        targetId,
        before,
        after,
      })),
    }
  }
}

function replacementParagraph(
  source: string,
  paragraph: XmlElement,
  edits: { node: XmlElement; after: string }[]
) {
  let expected = source.slice(paragraph.start, paragraph.end)
  for (const { node, after } of [...edits].sort(
    (left, right) => right.node.start - left.node.start
  )) {
    expected =
      expected.slice(0, node.start - paragraph.start) +
      replacementXml(source, node, after) +
      expected.slice(node.end - paragraph.start)
  }
  return expected
}

function paragraphVersion(paragraph: XmlElement) {
  const value = paragraph.attributes.find(
    (item) =>
      item.uri === "http://schemas.microsoft.com/office/word/2010/wordml" &&
      item.local === "textId"
  )?.value
  return value &&
    /^[0-7][a-fA-F0-9]{7}$/.test(value) &&
    Number.parseInt(value, 16) > 0
    ? [value.toUpperCase()]
    : []
}
