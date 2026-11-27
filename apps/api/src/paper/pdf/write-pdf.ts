import type { Box, FaceKey, Layout } from "@workspace/paper-engine"
import PDFDocument from "pdfkit"

export type PdfFonts = ReadonlyMap<FaceKey, Uint8Array>
export type PdfFiles = ReadonlyMap<string, Uint8Array>

const pt = (mpt: number) => mpt / 1000
const features = { kern: false, liga: false, clig: false, calt: false }
const positionedText: PDFKit.Mixins.PositionedTextOptions = {
  lineBreak: false,
  baseline: "alphabetic",
  features,
}

function drawBox(pdf: PDFKit.PDFDocument, box: Box, files: PdfFiles) {
  const { x, y, w, h } = box.rect
  switch (box.kind) {
    case "line":
      if (box.marker) {
        const marker = box.marker
        pdf.font(marker.font).fontSize(pt(marker.sizeMpt)).fillColor("#000000")
        pdf.text(marker.text, pt(marker.x), pt(box.baseline), positionedText)
      }
      for (const segment of box.segments) {
        pdf
          .font(segment.font)
          .fontSize(pt(segment.sizeMpt))
          .fillColor(segment.color)
        const width = pdf.widthOfString(segment.text, { features })
        pdf.text(segment.text, pt(segment.x), pt(box.baseline), {
          ...positionedText,
          horizontalScaling:
            segment.w > 0 && width > 0 ? (100 * pt(segment.w)) / width : 100,
          underline: segment.underline,
          strike: segment.strike,
          link: segment.href ?? undefined,
        })
      }
      break
    case "image": {
      const bytes = files.get(box.fileId)
      if (!bytes) throw new Error(`Missing PDF image: ${box.fileId}`)
      pdf.image(Buffer.from(bytes), pt(x), pt(y), {
        width: pt(w),
        height: pt(h),
      })
      break
    }
    case "rule":
      pdf.rect(pt(x), pt(y), pt(w), pt(h)).fill("#999999")
      break
    case "cell":
      if (box.borders === "all") {
        pdf.rect(pt(x), pt(y), pt(w), pt(h)).lineWidth(0.5).stroke("#999999")
      }
      break
    case "break":
      break
  }
}

export async function writePdf(
  layout: Layout,
  files: PdfFiles,
  fonts: PdfFonts
): Promise<Buffer> {
  const pdf = new PDFDocument({ autoFirstPage: false })
  for (const [face, bytes] of fonts) pdf.registerFont(face, Buffer.from(bytes))

  try {
    for (const page of layout.pages) {
      pdf.addPage({ size: [pt(page.size.w), pt(page.size.h)], margin: 0 })
      for (const box of page.boxes) drawBox(pdf, box, files)
    }
    pdf.end()

    const chunks: Buffer[] = []
    for await (const chunk of pdf) chunks.push(chunk)
    return Buffer.concat(chunks)
  } finally {
    pdf.destroy()
  }
}
