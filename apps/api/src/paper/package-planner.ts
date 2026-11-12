import {
  paperPackageEditSchema,
  paperPackageProjectionSchema,
  type WordOp,
  type WordParagraph,
  type WordRefusal,
} from "@workspace/domain"
import { z } from "zod"

import { insideTransaction } from "../db/context.js"
import { refuse } from "./package-errors.js"
import { PACKAGE_LIMITS } from "./package-limits.js"
import { packageDigest, packageFailure } from "./package-pages.js"
import { uniqueSpan } from "./package-spans.js"
import { wordPackageBasis } from "./package-store.js"
import { xmlCharacters } from "./package-xml.js"
import { draftBatch, open } from "./word/document.js"
import { changedSpan, type WordSpan } from "./word/mutate.js"

export const wordPackageEditSchema = paperPackageEditSchema

type Projection = z.infer<typeof paperPackageProjectionSchema>
type Region = Projection["regions"][number]
type Editable = Extract<Region, { kind: "editable" }>
type Edit = z.infer<typeof wordPackageEditSchema>["edits"][number]
type Placed = { edit: Edit; region: Editable; handle: string; span: WordSpan }

const sidecarKeys = z
  .object({
    paragraphs: z.array(z.object({ key: z.string() }).passthrough()),
  })
  .passthrough()

function failWith(refusal: WordRefusal): never {
  return packageFailure(refusal.message)
}

function lineRegions(projection: Projection, paragraph: number) {
  return projection.regions.filter(
    (region) => region.location.paragraph === paragraph
  )
}

function holdsWords(region: Region) {
  return region.kind === "editable" || region.reason.code === "PROOFING_RANGE"
}

function spanOf(
  projection: Projection,
  edit: Edit,
  region: Editable,
  line: WordParagraph
): WordSpan {
  if (
    !xmlCharacters(edit.before) ||
    !xmlCharacters(edit.after) ||
    /[\r\n\t]/.test(edit.after)
  )
    refuse("UNSUPPORTED_REPLACEMENT_TEXT")
  if (line.held) return packageFailure(line.message)
  const regions = lineRegions(projection, region.location.paragraph)
  const words = regions.filter(holdsWords)
  if (words.map((item) => item.text).join("") !== line.text)
    return packageFailure(
      "This line no longer matches the page. Read it again. No document was changed."
    )
  const offset = words
    .slice(0, words.indexOf(region))
    .reduce((sum, item) => sum + item.text.length, 0)
  const group: Region[] = []
  for (const item of regions.slice(regions.indexOf(region))) {
    if (item.kind !== "editable") break
    group.push(item)
  }
  const joined = group.map((item) => item.text).join("")
  if (group.length > 1 && edit.before === joined) {
    const change = changedSpan(joined, edit.after)
    return {
      start: offset + change.start,
      end: offset + change.end,
      text: change.text,
      lean: change.start === 0 ? "after" : "before",
    }
  }
  const span = uniqueSpan(region.text, edit.before)
  return {
    start: offset + span.start,
    end: offset + span.end,
    text: edit.after,
    lean: "before",
  }
}

export function plannedReplacements(
  projection: Projection,
  paragraphs: readonly WordParagraph[],
  keys: readonly string[],
  edits: readonly Edit[]
) {
  const lines = new Map(paragraphs.map((line) => [line.handle, line]))
  const seen = new Set<string>()
  let aggregate = 0
  const placed = edits.map((edit): Placed => {
    if (seen.has(edit.targetId)) refuse("DUPLICATE_TARGET")
    seen.add(edit.targetId)
    const beforeBytes = Buffer.byteLength(edit.before, "utf8")
    const afterBytes = Buffer.byteLength(edit.after, "utf8")
    aggregate += beforeBytes + afterBytes
    if (
      Math.max(beforeBytes, afterBytes) > PACKAGE_LIMITS.targetBytes ||
      aggregate > PACKAGE_LIMITS.replacementBytes
    )
      refuse("EDIT_TEXT_LIMIT")
    const region = projection.regions.find(
      (item): item is Editable =>
        item.kind === "editable" && item.targetId === edit.targetId
    )
    if (!region) return refuse("STALE_OR_FOREIGN_TARGET")
    const handle =
      keys[region.location.paragraph - 1] ?? refuse("SIDECAR_MAPPING_MISMATCH")
    const line = lines.get(handle)
    if (!line) return refuse("STALE_OR_FOREIGN_TARGET")
    return {
      edit,
      region,
      handle,
      span: spanOf(projection, edit, region, line),
    }
  })
  const changed = placed.filter((item) => item.edit.before !== item.edit.after)
  const spans = new Map<string, WordSpan[]>()
  for (const item of changed)
    spans.set(item.handle, [...(spans.get(item.handle) ?? []), item.span])
  const ops: WordOp[] = []
  for (const [handle, list] of spans) {
    const ordered = [...list].sort((left, right) => left.start - right.start)
    if (
      ordered.some((item, at) => {
        const previous = ordered[at - 1]
        return (
          previous !== undefined &&
          (item.start < previous.end ||
            (item.start === previous.start && item.end === previous.end))
        )
      })
    )
      refuse("DUPLICATE_TARGET")
    const line = lines.get(handle)
    if (!line) return refuse("STALE_OR_FOREIGN_TARGET")
    let text = line.text
    for (const item of [...ordered].reverse())
      text = text.slice(0, item.start) + item.text + text.slice(item.end)
    if (text !== line.text) ops.push({ op: "setText", handle, text })
  }
  return { changed, ops, spans }
}

export async function prepareWordPackage(owner: string, rawInput: unknown) {
  if (insideTransaction())
    return packageFailure("Prepare the Word edit before starting a save.")
  const input = wordPackageEditSchema.parse(rawInput)
  if (Buffer.byteLength(JSON.stringify(input)) > PACKAGE_LIMITS.requestBytes)
    return packageFailure("This Word edit is too large. Send fewer changes.")
  const { version, projection } = await wordPackageBasis(
    owner,
    input.docId,
    input.basedOn
  )
  const basis = {
    docId: version.docId,
    incarnation: version.incarnation,
    revision: version.revision,
    packageHash: version.packageHash,
    sidecarHash: version.sidecarHash,
    projectionHash: version.projectionHash,
    projector: version.projector,
  }
  const page = await open(owner, {
    kind: "read",
    doc: input.docId,
    at: input.basedOn,
  })
  if ("refused" in page) return failWith(page)
  const keys = sidecarKeys
    .parse(version.sidecar)
    .paragraphs.map((paragraph) => paragraph.key)
  const planned = plannedReplacements(
    projection,
    page.paragraphs,
    keys,
    input.edits
  )
  if (planned.changed.length === 0) return { kind: "unchanged" as const, basis }
  const review = {
    docId: input.docId,
    basedOn: input.basedOn,
    changes: planned.changed.map(({ edit, region }) => ({
      targetId: edit.targetId,
      before: edit.before,
      after: edit.after,
      location: region.location,
      formatting: region.formatting,
      context: region.context,
    })),
  }
  if (Buffer.byteLength(JSON.stringify(review)) > 128 * 1024)
    return packageFailure("This Word review is too large. Send fewer changes.")
  if (planned.ops.length === 0) return { kind: "unchanged" as const, basis }
  const drafted = await draftBatch(
    owner,
    { doc: input.docId, basedOn: input.basedOn, ops: planned.ops },
    planned.spans
  )
  if (drafted.refused) return failWith(drafted)
  return {
    kind: "prepared" as const,
    basis,
    inputHash: packageDigest(input),
    review,
    reviewHash: packageDigest(review),
    candidate: drafted.candidate,
  }
}
