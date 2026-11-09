import { byLocal, xmlDoc } from "./source-line.ts"

export type PictureOutline = { px: number; color: string } | null

export function pictureOutlines(documentXml: string): PictureOutline[] {
  return byLocal(xmlDoc(documentXml), "pic").map((picture) => {
    const line = byLocal(picture, "ln").find(
      (node) => node.getAttribute("w") && byLocal(node, "srgbClr")[0]
    )
    const fill = line ? byLocal(line, "srgbClr")[0] : undefined
    if (!line || !fill) return null
    return {
      px: Math.max(1, Number(line.getAttribute("w")) / 12700),
      color: `#${fill.getAttribute("val") || "000000"}`,
    }
  })
}

export function paintPictureOutlines(root: ParentNode, documentXml: string) {
  const images = [...root.querySelectorAll("article img")]
  pictureOutlines(documentXml).forEach((outline, index) => {
    const image = images[index]
    if (!outline || !(image instanceof HTMLElement)) return
    image.style.outline = `${outline.px}px solid ${outline.color}`
    image.style.outlineOffset = "0px"
  })
}
