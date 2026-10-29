import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"
import {
  blocksToPreviewModel,
  isCvBlockDocument,
  isCvDocument,
  type CvDocument as CvDocumentData,
} from "@workspace/domain"

import { CvDocument } from "./cv-print-document.tsx"
import { CvPhotoFrame } from "./cv-templates/cv-parts.tsx"
import { quietPaperChrome } from "./paper-print.ts"
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

function useQuietPaper<T extends HTMLElement>(rootRef: RefObject<T | null>) {
  useEffect(() => {
    if (rootRef.current) quietPaperChrome(rootRef.current)
  })
}

function useMeasureMount(measureRef: RefObject<HTMLDivElement | null>) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [mount, dispatchMount] = useReducer(
    (_: HTMLDivElement | null, node: HTMLDivElement) => node,
    null
  )

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" })
    let node = shadow.querySelector<HTMLDivElement>("[data-paper-measure]")
    if (!node) {
      const copies: CSSStyleSheet[] = []
      for (const sheet of document.styleSheets) {
        try {
          const copy = new CSSStyleSheet()
          copy.replaceSync(
            [...sheet.cssRules].map((rule) => rule.cssText).join("\n")
          )
          copies.push(copy)
        } catch {
          // A cross-origin sheet, or jsdom without constructed stylesheets.
        }
      }
      if (copies.length > 0) shadow.adoptedStyleSheets = copies
      node = document.createElement("div")
      node.setAttribute("data-paper-measure", "")
      node.className = "paper-print-measure"
      shadow.append(node)
    }
    measureRef.current = node
    dispatchMount(node)
    return () => {
      if (measureRef.current === node) measureRef.current = null
    }
  }, [measureRef])

  return { hostRef, mount }
}

export function PaperPrintMeasure({
  source,
  templateId,
  docId,
  measureRef,
}: {
  source: unknown
  templateId: string | null
  docId?: string
  measureRef: RefObject<HTMLDivElement | null>
}) {
  const preview = previewOf(source, templateId)
  const { hostRef, mount } = useMeasureMount(measureRef)
  useQuietPaper(measureRef)
  if (!preview) return null
  return (
    <div ref={hostRef} aria-hidden="true" className="paper-print-measure">
      {mount
        ? createPortal(
            <CvPhotoFrame value={{ docId }}>
              <CvDocument data={preview} onChange={() => undefined} />
            </CvPhotoFrame>,
            mount
          )
        : null}
    </div>
  )
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
  const rootRef = useRef<HTMLElement | null>(null)
  useQuietPaper(rootRef)
  const host = globalThis.document
  if (!host) return null
  if (kind === "letter") {
    return createPortal(
      <article
        ref={(node) => {
          rootRef.current = node
        }}
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
      ref={(node) => {
        rootRef.current = node
      }}
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
