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

export const wordPackageEditSchema = paperPackageEditSchema

type Projection = z.infer<typeof paperPackageProjectionSchema>
type Region = Projection["regions"][number]
type Editable = Extract<Region, { kind: "editable" }>
type Edit = z.infer<typeof wordPackageEditSchema>["edits"][number]
type Placed = {
  edit: Edit
  region: Editable
  start: number
  end: number
  whole: boolean
}

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

function place(
  projection: Projection,
  edit: Edit,
  region: Editable,
  line: WordParagraph
): Placed {
  if (
    !xmlCharacters(edit.before) ||
    !xmlCharacters(edit.after) ||
    /[\r\n\t]/.test(edit.after)
  )
    refuse("UNSUPPORTED_REPLACEMENT_TEXT")
  if (line.held) return packageFailure(line.message)
  const regions = lineRegions(projection, region.location.paragraph)
  if (
    regions.some((item) => item.kind !== "editable") ||
    regions.map((item) => item.text).join("") !== line.text
  )
    return packageFailure(
      "Part of this line is kept exactly as it is in Word, so Paper will not rewrite it. No document was changed."
    )
  const index = regions.indexOf(region)
  const offset = regions
    .slice(0, index)
    .reduce((sum, item) => sum + item.text.length, 0)
  const group = regions
    .slice(index)
    .map((item) => item.text)
    .join("")
  if (index < regions.length - 1 && edit.before === group)
    return {
      edit,
      region,
      start: offset,
      end: offset + group.length,
      whole: true,
    }
  const span = uniqueSpan(region.text, edit.before)
  return {
    edit,
    region,
    start: offset + span.start,
    end: offset + span.end,
    whole: false,
  }
}

function spliced(text: string, placed: readonly Placed[]) {
  let next = text
  for (const item of [...placed].sort(
    (left, right) => right.start - left.start
  ))
    next = next.slice(0, item.start) + item.edit.after + next.slice(item.end)
  return next
}

function expectedPieces(regions: readonly Region[], placed: readonly Placed[]) {
  const pieces: { formatting: string; text: string }[] = []
  for (const region of regions) {
    if (region.kind !== "editable") continue
    const edit = placed.find((item) => item.region === region)
    const text = edit
      ? region.text.replace(edit.edit.before, () => edit.edit.after)
      : region.text
    const formatting = JSON.stringify(region.formatting)
    const last = pieces.at(-1)
    if (last && last.formatting === formatting) last.text += text
    else pieces.push({ formatting, text })
  }
  return pieces.map((piece) => piece.text).filter(Boolean)
}

function keepsFormatting(
  regions: readonly Region[],
  placed: readonly Placed[],
  written: WordParagraph | undefined
) {
  if (placed.some((item) => item.whole)) return true
  if (!written || written.held) return false
  const actual = written.pieces
    .map((piece) => piece.text)
    .filter(Boolean)
    .join("\u0000")
  return expectedPieces(regions, placed).join("\u0000") === actual
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
  const keys = sidecarKeys.parse(version.sidecar).paragraphs
  const lines = new Map(page.paragraphs.map((line) => [line.handle, line]))
  const handleOf = (region: Editable) =>
    keys[region.location.paragraph - 1]?.key ??
    refuse("SIDECAR_MAPPING_MISMATCH")
  const seen = new Set<string>()
  let aggregate = 0
  const placed = input.edits.map((edit) => {
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
    const line = lines.get(handleOf(region))
    if (!line) return refuse("STALE_OR_FOREIGN_TARGET")
    return place(projection, edit, region, line)
  })
  const changed = placed.filter((item) => item.edit.before !== item.edit.after)
  if (changed.length === 0) return { kind: "unchanged" as const, basis }
  const review = {
    docId: input.docId,
    basedOn: input.basedOn,
    changes: changed.map(({ edit, region }) => ({
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
  const byLine = new Map<string, Placed[]>()
  for (const item of placed) {
    const handle = handleOf(item.region)
    byLine.set(handle, [...(byLine.get(handle) ?? []), item])
  }
  const ops: WordOp[] = []
  for (const [handle, items] of byLine) {
    const ordered = [...items].sort((left, right) => left.start - right.start)
    if (
      ordered.some(
        (item, at) => at > 0 && item.start < (ordered[at - 1]?.end ?? 0)
      )
    )
      refuse("DUPLICATE_TARGET")
    const line = lines.get(handle)
    if (!line) return refuse("STALE_OR_FOREIGN_TARGET")
    const text = spliced(line.text, ordered)
    if (text !== line.text) ops.push({ op: "setText", handle, text })
  }
  if (ops.length === 0) return { kind: "unchanged" as const, basis }
  const drafted = await draftBatch(owner, {
    doc: input.docId,
    basedOn: input.basedOn,
    ops,
  })
  if (drafted.refused) return failWith(drafted)
  const written = new Map(
    drafted.page.paragraphs.map((line) => [line.handle, line])
  )
  for (const [handle, items] of byLine) {
    const paragraph = items[0]?.region.location.paragraph ?? 0
    if (
      !keepsFormatting(
        lineRegions(projection, paragraph),
        items,
        written.get(handle)
      )
    )
      return packageFailure(
        "This change would move words into different formatting, such as bold or a different font. Paper will not change that line. No document was changed."
      )
  }
  return {
    kind: "prepared" as const,
    basis,
    inputHash: packageDigest(input),
    review,
    reviewHash: packageDigest(review),
    candidate: drafted.candidate,
  }
}
