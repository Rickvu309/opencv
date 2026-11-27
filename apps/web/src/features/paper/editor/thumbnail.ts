import type { LayoutPage, PageSetup } from "@workspace/domain/paper-doc"
import type { Layout } from "@workspace/paper-engine"

import { cardFaceHeights } from "./card-faces.js"
import { createPainter, placement } from "./painter.js"
import "./paper-editor.css"

const CARD_PAGE: PageSetup = {
  size: "A4",
  orientation: "portrait",
  marginsMpt: { top: 0, right: 0, bottom: 0, left: 0 },
}

type PaintedCard = { sheet: Node; widthPx: number; heightPx: number }

const paintedCards = new WeakMap<LayoutPage, PaintedCard>()

function paintOnce(page: LayoutPage): PaintedCard {
  const known = paintedCards.get(page)
  if (known) return known
  const layout: Layout = { page: CARD_PAGE, pages: [page], blockPages: {} }
  const holder = document.createElement("div")
  createPainter(holder, cardFaceHeights).paint(layout)
  const { widthPx, heightPx } = placement(layout)
  const card = { sheet: holder.firstChild!, widthPx, heightPx }
  paintedCards.set(page, card)
  return card
}

export function paintThumbnail(stage: HTMLElement, page: LayoutPage) {
  const { sheet, widthPx, heightPx } = paintOnce(page)
  stage.style.width = `${widthPx}px`
  stage.style.height = `${heightPx}px`
  stage.style.transform = `scale(tan(atan2(100cqw, ${widthPx}px)))`
  stage.replaceChildren(sheet.cloneNode(true))
  return () => {
    stage.replaceChildren()
  }
}
