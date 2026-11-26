import { z } from "zod"
import {
  photoBounds,
  type LayoutPhoto,
} from "@workspace/domain/internal/paper-presentation"
import { paperPhotoFileId } from "@workspace/domain/paper-doc"
import { xml } from "./rich-text.js"

const mediaSchema = z
  .object({
    source: z.string().refine((value) => paperPhotoFileId(value) !== null),
    mediaType: z.enum(["image/png", "image/jpeg", "image/gif"]),
    bytes: z
      .instanceof(Uint8Array)
      .refine(
        (bytes) => bytes.byteLength > 0 && bytes.byteLength <= 2 * 1024 * 1024
      ),
  })
  .strict()
export type PhotoMedia = z.infer<typeof mediaSchema>
export type WordMedia = {
  id: string
  name: string
  mediaType: string
  bytes: Uint8Array
}
const A = "http://schemas.openxmlformats.org/drawingml/2006/main"
const WP =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
const PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture"
const WPG = "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
const emu = (twips: number) => Math.round(twips * 635)

function extension(media: PhotoMedia) {
  const bytes = media.bytes
  if (
    media.mediaType === "image/png" &&
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte) &&
    String.fromCharCode(...bytes.slice(12, 16)) === "IHDR"
  )
    return "png"
  if (
    media.mediaType === "image/jpeg" &&
    bytes.length >= 4 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "jpg"
  if (
    media.mediaType === "image/gif" &&
    bytes.length >= 10 &&
    /GIF8[79]a/.test(String.fromCharCode(...bytes.slice(0, 6)))
  )
    return "gif"
  throw new Error("Photo media type does not match its bytes")
}

export function photoWriter(input: readonly PhotoMedia[]) {
  if (input.length > 100) throw new Error("Too many resolved photos")
  const resolved = input.map((item) => mediaSchema.parse(item))
  if (new Set(resolved.map((item) => item.source)).size !== resolved.length)
    throw new Error("Duplicate resolved photo")
  if (
    resolved.reduce((total, item) => total + item.bytes.byteLength, 0) >
    20 * 1024 * 1024
  )
    throw new Error("Resolved photos exceed the Word media limit")
  const media: WordMedia[] = []
  const sources = new Map<string, WordMedia>()
  let drawingId = 0
  function render(photo: LayoutPhoto, availableWidth: number) {
    let asset = sources.get(photo.source)
    if (!asset) {
      const item = resolved.find((item) => item.source === photo.source)
      if (!item)
        throw new Error("Word output requires resolved owned photo media")
      asset = {
        id: `photo${media.length + 1}`,
        name: `photo${media.length + 1}.${extension(item)}`,
        mediaType: item.mediaType,
        bytes: item.bytes,
      }
      sources.set(photo.source, asset)
      media.push(asset)
    }
    const id = ++drawingId
    const width = emu(photo.width),
      height = emu(photo.height)
    const bounds = photoBounds(photo)
    const boundWidth = emu(bounds.width),
      boundHeight = emu(bounds.height)
    const offsetX = Math.round((boundWidth - width) / 2),
      offsetY = Math.round((boundHeight - height) / 2)
    const shape =
      photo.shape === "circle"
        ? "ellipse"
        : photo.shape === "rounded"
          ? "roundRect"
          : "rect"
    const picture = `<pic:pic xmlns:pic="${PIC}"><pic:nvPicPr><pic:cNvPr id="${id}" name="${xml(photo.id)}" descr="${xml(photo.alt)}"/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="${asset.id}"/><a:srcRect l="${photo.crop.left}" t="${photo.crop.top}" r="${photo.crop.right}" b="${photo.crop.bottom}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm rot="${photo.rotation * 60000}"><a:off x="${offsetX}" y="${offsetY}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="${shape}"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>`
    const graphic = `<a:graphic xmlns:a="${A}"><a:graphicData uri="${WPG}"><wpg:wgp xmlns:wpg="${WPG}"><wpg:cNvGrpSpPr/><wpg:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${boundWidth}" cy="${boundHeight}"/><a:chOff x="0" y="0"/><a:chExt cx="${boundWidth}" cy="${boundHeight}"/></a:xfrm></wpg:grpSpPr>${picture}</wpg:wgp></a:graphicData></a:graphic>`
    const extent = `<wp:extent cx="${boundWidth}" cy="${boundHeight}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="${xml(photo.id)}" descr="${xml(photo.alt)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="${A}" noChangeAspect="1"/></wp:cNvGraphicFramePr>${graphic}`
    const distance = `distT="${emu(photo.spacing.top)}" distB="${emu(photo.spacing.bottom)}" distL="${emu(photo.spacing.left)}" distR="${emu(photo.spacing.right)}"`
    let drawing: string
    let properties: string
    if (photo.placement.kind === "wrap") {
      const horizontal =
        photo.placement.side === "left"
          ? photo.spacing.left
          : availableWidth - bounds.width - photo.spacing.right
      drawing = `<wp:anchor xmlns:wp="${WP}" ${distance} simplePos="0" relativeHeight="0" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="0"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>${emu(horizontal)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${emu(photo.spacing.top)}</wp:posOffset></wp:positionV>${extent.replace("<wp:docPr", '<wp:wrapSquare wrapText="bothSides"/><wp:docPr')}</wp:anchor>`
      properties =
        '<w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/>'
    } else {
      drawing = `<wp:inline xmlns:wp="${WP}" ${distance}>${extent}</wp:inline>`
      properties = `<w:jc w:val="${photo.placement.alignment}"/><w:ind w:left="${photo.spacing.left}" w:right="${photo.spacing.right}"/><w:spacing w:before="${photo.spacing.top}" w:after="${photo.spacing.bottom}"/>`
    }
    return `<w:p><w:pPr>${properties}</w:pPr><w:r><w:drawing>${drawing}</w:drawing></w:r></w:p>`
  }
  return { media, render }
}
