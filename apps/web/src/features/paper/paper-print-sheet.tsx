import { createPortal } from "react-dom"
import {
  blocksToPreviewModel,
  isCvBlockDocument,
  isCvDocument,
  type CvDocument as CvDocumentData,
} from "@workspace/domain"

import { CvDocument } from "./cv-print-document.tsx"
import { CvPhotoFrame } from "./cv-templates/cv-parts.tsx"
import { printLayout } from "./paper-templates.ts"

function markdownOf(source: unknown) {
  if (!source || typeof source !== "object" || !("markdown" in source))
    return ""
  const markdown = (source as { markdown: unknown }).markdown
  return typeof markdown === "string" ? markdown : ""
}

function previewOf(
  source: unknown,
  templateId: string | null
): CvDocumentData | null {
  const layout = printLayout(templateId)
  if (isCvBlockDocument(source)) return blocksToPreviewModel(source, layout)
  if (!isCvDocument(source)) return null
  return { ...source, templateId: layout }
}

export function PaperPrintSheet({
  name,
  kind,
  source,
  templateId,
  docId,
  shareToken,
}: {
  name: string
  kind: string
  source: unknown
  templateId: string | null
  docId?: string
  shareToken?: string
}) {
  const host = globalThis.document
  if (!host) return null
  if (kind === "letter") {
    return createPortal(
      <article
        data-paper-print=""
        data-paper-letter=""
        className="paper-print-sheet"
        aria-hidden="true"
        inert
      >
        <h1 className="text-lg font-medium">{name}</h1>
        <p className="whitespace-pre-wrap">{markdownOf(source)}</p>
      </article>,
      host.body
    )
  }
  const preview = previewOf(source, templateId)
  if (!preview) return null
  return createPortal(
    <div
      data-paper-print=""
      className="paper-print-sheet"
      aria-hidden="true"
      inert
    >
      <CvPhotoFrame value={shareToken ? { shareToken } : { docId }}>
        <CvDocument data={preview} onChange={() => undefined} />
      </CvPhotoFrame>
    </div>,
    host.body
  )
}
