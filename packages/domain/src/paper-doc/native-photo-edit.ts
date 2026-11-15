import { z } from "zod"
import { nodeIdSchema } from "./nodes.js"
import { layoutPhotoSchema } from "./native-photo.js"
import { privatePhotoLayoutSchema } from "./native-layout.js"
import { restoreLayoutValue } from "./native-layout-edit.js"
import { canonical, ok, refuse, type Result } from "./presentation-values.js"

const positionSchema = z
  .object({
    parentId: nodeIdSchema,
    previousId: nodeIdSchema.nullable(),
    nextId: nodeIdSchema.nullable(),
  })
  .strict()
const destinationSchema = z
  .object({ parentId: nodeIdSchema, afterId: nodeIdSchema.nullable() })
  .strict()
export const layoutPhotoEditSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("insert-photo"),
      photo: layoutPhotoSchema,
      destination: destinationSchema,
    })
    .strict(),
  z
    .object({ kind: z.literal("update-photo"), photo: layoutPhotoSchema })
    .strict(),
  z
    .object({
      kind: z.literal("replace-photo"),
      photoId: nodeIdSchema,
      source: layoutPhotoSchema.shape.source,
    })
    .strict(),
  z.object({ kind: z.literal("remove-photo"), photoId: nodeIdSchema }).strict(),
  z
    .object({
      kind: z.literal("move-photo"),
      photoId: nodeIdSchema,
      destination: destinationSchema,
    })
    .strict(),
])
export const layoutPhotoReceiptSchema = z
  .object({
    version: z.literal(1),
    profile: z.literal("private-layout-2"),
    kind: z.enum(["cv", "letter"]),
    flowId: nodeIdSchema,
    before: layoutPhotoSchema.nullable(),
    after: layoutPhotoSchema.nullable(),
    beforePosition: positionSchema.nullable(),
    afterPosition: positionSchema.nullable(),
  })
  .strict()
  .refine(
    (receipt) =>
      (receipt.before !== null || receipt.after !== null) &&
      Boolean(receipt.before) === Boolean(receipt.beforePosition) &&
      Boolean(receipt.after) === Boolean(receipt.afterPosition) &&
      (!receipt.before ||
        !receipt.after ||
        receipt.before.id === receipt.after.id),
    "Photo receipt identities disagree"
  )
export type LayoutPhotoReceipt = z.infer<typeof layoutPhotoReceiptSchema>
type PhotoDocument = z.infer<typeof privatePhotoLayoutSchema>
type Position = z.infer<typeof positionSchema>
function parents(doc: PhotoDocument) {
  return [
    doc.flow,
    ...doc.flow.children.flatMap((node) =>
      node.type === "table" ? node.children.flatMap((row) => row.children) : []
    ),
  ]
}
function locate(doc: PhotoDocument, id: string) {
  for (const parent of parents(doc)) {
    const index = parent.children.findIndex((node) => node.id === id)
    const node = parent.children[index]
    if (node?.type === "photo")
      return {
        parent,
        index,
        node,
        position: {
          parentId: parent.id,
          previousId: parent.children[index - 1]?.id ?? null,
          nextId: parent.children[index + 1]?.id ?? null,
        },
      }
  }
  throw new Error("Missing photo")
}
function insert(
  doc: PhotoDocument,
  photo: z.infer<typeof layoutPhotoSchema>,
  destination: z.infer<typeof destinationSchema>
) {
  const parent = parents(doc).find((node) => node.id === destination.parentId)
  if (!parent) throw new Error("Photo parent must be the flow or a table cell")
  const index =
    destination.afterId === null
      ? 0
      : parent.children.findIndex((node) => node.id === destination.afterId) + 1
  if (destination.afterId !== null && index === 0)
    throw new Error("Missing photo insertion neighbor")
  parent.children.splice(index, 0, photo)
  return locate(doc, photo.id).position
}
function reinsert(
  doc: PhotoDocument,
  photo: z.infer<typeof layoutPhotoSchema>,
  position: Position
) {
  const parent = parents(doc).find((node) => node.id === position.parentId)
  if (!parent) throw new Error("Photo parent no longer exists")
  const index =
    position.previousId === null
      ? 0
      : parent.children.findIndex((node) => node.id === position.previousId) + 1
  if (
    (position.previousId !== null && index === 0) ||
    (parent.children[index]?.id ?? null) !== position.nextId
  )
    throw new Error("Photo neighbors changed after this action")
  insert(doc, photo, {
    parentId: position.parentId,
    afterId: position.previousId,
  })
}
export function prepareLayoutPhotoEdit(
  input: unknown,
  edit: unknown
): Result<{
  document: PhotoDocument
  receipt: LayoutPhotoReceipt
  basis: string
}> {
  try {
    const doc = privatePhotoLayoutSchema.parse(input),
      basis = canonical(doc),
      change = layoutPhotoEditSchema.parse(edit)
    const existing =
      change.kind === "insert-photo"
        ? null
        : locate(
            doc,
            change.kind === "update-photo" ? change.photo.id : change.photoId
          )
    const before = existing ? layoutPhotoSchema.parse(existing.node) : null
    const beforePosition = existing?.position ?? null
    if (change.kind === "insert-photo")
      insert(doc, change.photo, change.destination)
    else {
      if (!existing) throw new Error("Missing photo")
      if (change.kind === "update-photo")
        existing.parent.children.splice(existing.index, 1, change.photo)
      else if (change.kind === "replace-photo")
        existing.parent.children.splice(
          existing.index,
          1,
          layoutPhotoSchema.parse({ ...existing.node, source: change.source })
        )
      else {
        existing.parent.children.splice(existing.index, 1)
        if (change.kind === "move-photo")
          insert(doc, existing.node, change.destination)
      }
    }
    const id =
      change.kind === "insert-photo" || change.kind === "update-photo"
        ? change.photo.id
        : change.photoId
    const after = change.kind === "remove-photo" ? null : locate(doc, id)
    return ok({
      document: privatePhotoLayoutSchema.parse(doc),
      basis,
      receipt: layoutPhotoReceiptSchema.parse({
        version: 1,
        profile: doc.profile,
        kind: doc.kind,
        flowId: doc.flow.id,
        before,
        after: after?.node ?? null,
        beforePosition,
        afterPosition: after?.position ?? null,
      }),
    })
  } catch (error) {
    return refuse(error instanceof Error ? error.message : "Invalid photo edit")
  }
}
export function reverseLayoutPhotoEdit(
  input: unknown,
  inverse: unknown
): Result<PhotoDocument> {
  try {
    const doc = privatePhotoLayoutSchema.parse(input),
      receipt = layoutPhotoReceiptSchema.parse(inverse)
    if (doc.kind !== receipt.kind || doc.flow.id !== receipt.flowId)
      throw new Error("Foreign photo receipt")
    if (receipt.after) {
      const live = locate(doc, receipt.after.id)
      if (canonical(live.position) !== canonical(receipt.afterPosition))
        throw new Error("Photo position changed after this action")
      const restored = receipt.before
        ? layoutPhotoSchema.parse(
            restoreLayoutValue(receipt.before, receipt.after, live.node)
          )
        : null
      if (!restored && canonical(live.node) !== canonical(receipt.after))
        throw new Error("Inserted photo has later edits")
      live.parent.children.splice(live.index, 1)
      if (restored && receipt.beforePosition)
        reinsert(doc, restored, receipt.beforePosition)
    } else if (receipt.before && receipt.beforePosition) {
      if (
        parents(doc).some((parent) =>
          parent.children.some((node) => node.id === receipt.before?.id)
        )
      )
        throw new Error("Removed photo identity is already in use")
      reinsert(doc, receipt.before, receipt.beforePosition)
    }
    return ok(privatePhotoLayoutSchema.parse(doc))
  } catch (error) {
    return refuse(
      error instanceof Error ? error.message : "Invalid photo reversal"
    )
  }
}
