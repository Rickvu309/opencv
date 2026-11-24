import { createHash, createHmac, timingSafeEqual } from "node:crypto"

import {
  ERROR_CODES,
  PAPER_PACKAGE_LIMITS,
  PAPER_PACKAGE_PROJECTOR,
  paperPackageReadSchema,
  type PaperPackageMetadata,
  type PaperPackageProjection,
  type PaperPackageRead,
} from "@workspace/domain"
import { z } from "zod"

import { CommandError } from "../platform/errors.js"

const positionSchema = z
  .object({
    docId: z.string().uuid(),
    revision: z.string().uuid(),
    incarnation: z.string().uuid(),
    projector: z.literal(PAPER_PACKAGE_PROJECTOR),
    reader: z.literal("word").optional(),
    index: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
  })
  .strict()
type Position = z.infer<typeof positionSchema>
const cursorSchema = z
  .object({
    position: positionSchema,
    signature: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

export function packageFailure(message: string): never {
  throw new CommandError(ERROR_CODES.CONFLICT, message)
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const text = JSON.stringify(value)
    if (text === undefined)
      return packageFailure("The stored Word version is incomplete.")
    return text
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  return `{${Object.entries(value)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`
}

export function packageDigest(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex")
}

export function archiveDigest(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex")
}

export function decodePackageCursor(value: string) {
  try {
    if (Buffer.byteLength(value) > PAPER_PACKAGE_LIMITS.cursorBytes)
      return packageFailure(
        "This page link is invalid. Read the document again."
      )
    return cursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    )
  } catch {
    return packageFailure("This page link is invalid. Read the document again.")
  }
}

function signature(position: Position, owner: string, key: string) {
  return createHmac("sha256", key)
    .update(canonicalJson({ owner, position }))
    .digest("hex")
}

export function encodePackageCursor(
  position: Position,
  owner: string,
  key: string
) {
  return Buffer.from(
    JSON.stringify({ position, signature: signature(position, owner, key) })
  ).toString("base64url")
}

export function packageCursorSigned(
  token: { position: Position; signature: string },
  owner: string,
  key: string
) {
  return timingSafeEqual(
    Buffer.from(token.signature, "hex"),
    Buffer.from(signature(token.position, owner, key), "hex")
  )
}

function withParagraph<
  T extends { location: { paragraph: number }; paragraph?: string },
>(item: T, keys: readonly string[] | undefined): T {
  const key = keys?.[item.location.paragraph - 1]
  if (!key) return item
  return { ...item, paragraph: key }
}

export function packagePage(input: {
  metadata: PaperPackageMetadata
  projection: PaperPackageProjection
  owner: string
  key: string
  cursor?: string
  paragraphKeys?: readonly string[]
}): PaperPackageRead {
  const { metadata, projection, owner, key } = input
  let index = 0
  let offset = 0
  if (input.cursor) {
    const token = decodePackageCursor(input.cursor)
    const position = token.position
    if (
      position.reader !== undefined ||
      position.docId !== metadata.docId ||
      position.revision !== metadata.revision ||
      position.incarnation !== projection.incarnation ||
      !packageCursorSigned(token, owner, key)
    )
      return packageFailure("This page belongs to another document or version.")
    index = position.index
    offset = position.offset
    const region = projection.regions[index]
    if (
      !region ||
      offset > region.text.length ||
      (offset > 0 && /[\uD800-\uDBFF]/.test(region.text[offset - 1] ?? ""))
    )
      return packageFailure(
        "This page link is invalid. Read the document again."
      )
  }
  const cursor = (at: number, from: number) =>
    at < projection.regions.length
      ? encodePackageCursor(
          {
            docId: metadata.docId,
            revision: metadata.revision,
            incarnation: projection.incarnation,
            projector: PAPER_PACKAGE_PROJECTOR,
            index: at,
            offset: from,
          },
          owner,
          key
        )
      : null
  const page = (
    regions: PaperPackageRead["regions"],
    at: number,
    from: number
  ) => ({
    ...metadata,
    projector: PAPER_PACKAGE_PROJECTOR,
    regions,
    nextCursor: cursor(at, from),
  })
  const fits = (
    regions: PaperPackageRead["regions"],
    at: number,
    from: number
  ) =>
    Buffer.byteLength(
      JSON.stringify({ ok: true, data: page(regions, at, from) })
    ) <= PAPER_PACKAGE_LIMITS.pageBytes
  const regions: PaperPackageRead["regions"] = []
  while (
    index < projection.regions.length &&
    regions.length < PAPER_PACKAGE_LIMITS.pageRegions
  ) {
    const region = projection.regions[index]
    if (!region) break
    const keyed = withParagraph(region, input.paragraphKeys)
    let item: PaperPackageRead["regions"][number]
    let nextIndex = index + 1
    let nextOffset = 0
    if (keyed.kind === "editable" && fits([keyed], nextIndex, 0)) {
      item = keyed
    } else {
      let text = ""
      for (const scalar of region.text.slice(offset)) {
        if (
          Buffer.byteLength(text) + Buffer.byteLength(scalar) >
          PAPER_PACKAGE_LIMITS.textBytes
        )
          break
        text += scalar
      }
      const complete = offset + text.length === region.text.length
      item = {
        kind: "locked",
        text,
        location: region.location,
        reason:
          region.kind === "locked"
            ? region.reason
            : {
                code: "PUBLIC_REGION_TOO_LARGE",
                message:
                  "This text has more formatting than this edit view can safely show.",
              },
        complete,
        continuation: offset > 0,
      }
      item = withParagraph(item, input.paragraphKeys)
      if (!complete) {
        nextIndex = index
        nextOffset = offset + text.length
      }
    }
    if (!fits([...regions, item], nextIndex, nextOffset)) break
    regions.push(item)
    index = nextIndex
    offset = nextOffset
  }
  if (regions.length === 0 && index < projection.regions.length)
    return packageFailure("This Word region is too large to read safely.")
  return paperPackageReadSchema.parse(page(regions, index, offset))
}
