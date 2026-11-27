import type { BlockId, PageSetup } from "@workspace/domain/paper-doc"

export type Mpt = number
export type FaceKey = string
export type Rect = { x: Mpt; y: Mpt; w: Mpt; h: Mpt }
export type CellRef = { row: number; col: number }

export type Segment = {
  x: Mpt
  w: Mpt
  text: string
  from: number
  font: FaceKey
  sizeMpt: Mpt
  color: string
  underline: boolean
  strike: boolean
  href: string | null
}

export type Marker = { text: string; x: Mpt; font: FaceKey; sizeMpt: Mpt }

export type LineBox = {
  kind: "line"
  block: BlockId
  cell?: CellRef
  rect: Rect
  baseline: Mpt
  from: number
  to: number
  marker: Marker | null
  segments: readonly Segment[]
}

export type Box =
  | LineBox
  | { kind: "image"; block: BlockId; rect: Rect; fileId: string }
  | { kind: "rule"; block: BlockId; rect: Rect }
  | { kind: "break"; block: BlockId; rect: Rect }
  | {
      kind: "cell"
      block: BlockId
      row: number
      col: number
      rect: Rect
      borders: "none" | "all"
    }

export type Page = {
  index: number
  size: { w: Mpt; h: Mpt }
  content: Rect
  boxes: readonly Box[]
}

export type Layout = {
  page: PageSetup
  pages: readonly Page[]
  blockPages: Readonly<Record<string, readonly number[]>>
}

export type LayoutWork = { blocksLaidOut: number; pagesPaginated: number }

export type FontFace = {
  ascent: number
  descent: number
  lineGap: number
  advance(codePoint: number): number
}

export interface Metrics {
  face(key: FaceKey): FontFace
}
