import { useEffect, useRef, useState } from "react"
import { renderAsync } from "docx-preview"

import { paintColumns } from "./columns.ts"
import { fontFacesFromXml, fontWarning } from "./font-warning.ts"
import {
  bindTails,
  headerSplitNote,
  joinKeptGroups,
  paintHeaders,
  paintRules,
} from "./keepers.ts"
import { paintPictureOutlines } from "./picture-outline.ts"
import { paintSourceLines, readDocxParts } from "./source-line.ts"
import {
  markShortRegions,
  measureAdvances,
  shortAdvanceNote,
  type LineMeasure,
} from "./short-advance.ts"
import "./preview.css"

const renderOptions = {
  breakPages: true,
  ignoreLastRenderedPageBreak: false,
  renderHeaders: true,
  renderFooters: true,
  renderAltChunks: false,
}

export function WordPagePreview({
  bytes,
  advances,
}: {
  bytes: ArrayBuffer
  advances?: LineMeasure[]
}) {
  const host = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState("Loading pages")
  useEffect(() => {
    const node = host.current
    if (!node) return
    let cancel = false
    const run = async () => {
      node.replaceChildren()
      try {
        await renderAsync(bytes, node, undefined, renderOptions)
        if (cancel) return
        const parts = await readDocxParts(bytes)
        paintHeaders(node, parts.documentXml, parts.headers)
        paintColumns(node, parts.documentXml)
        paintRules(node, parts.documentXml)
        bindTails(node)
        const lineNote = paintSourceLines(
          node,
          parts.documentXml,
          parts.stylesXml
        )
        paintPictureOutlines(node, parts.documentXml)
        joinKeptGroups(node)
        const measured = advances ?? measureAdvances(node)
        markShortRegions(node, measured)
        const notice = [
          fontWarning(fontFacesFromXml(parts.xml)),
          lineNote,
          shortAdvanceNote(measured),
          headerSplitNote(node),
        ]
          .filter(Boolean)
          .join(" ")
        if (!cancel) setStatus(notice || "Pages use the original Word file.")
      } catch {
        if (!cancel) setStatus("These pages could not be drawn.")
      }
    }
    void run()
    return () => {
      cancel = true
    }
  }, [advances, bytes])
  return (
    <section aria-label="Word pages" className="word-pages">
      <p className="word-pages-status">{status}</p>
      <div ref={host} className="word-pages-host" />
    </section>
  )
}
