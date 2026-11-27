import type { LayoutPage, PageSetup } from "@workspace/domain/paper-doc"
import { paperFontMetrics, type Layout } from "@workspace/paper-engine"

import { createPainter, placement } from "./painter.js"
import "./paper-editor.css"

const CARD_PAGE: PageSetup = {
  size: "A4",
  orientation: "portrait",
  marginsMpt: { top: 0, right: 0, bottom: 0, left: 0 },
}

export function paintThumbnail(stage: HTMLElement, page: LayoutPage) {
  const layout: Layout = { page: CARD_PAGE, pages: [page], blockPages: {} }
  const painter = createPainter(stage, paperFontMetrics)
  painter.paint(layout)
  const { widthPx, heightPx } = placement(layout)
  stage.style.width = `${widthPx}px`
  stage.style.height = `${heightPx}px`
  stage.style.setProperty("--cv-paper-page-px", `${widthPx}px`)
  return () => {
    stage.replaceChildren()
  }
}
