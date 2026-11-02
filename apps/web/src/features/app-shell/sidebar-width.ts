import { readStored, writeStored } from "@/lib/local-storage.ts"

export const DEFAULT_SIDEBAR_WIDTH = 244
export const MIN_SIDEBAR_WIDTH = 216
export const MAX_SIDEBAR_WIDTH = 360
export const COLLAPSE_BELOW_WIDTH = 140
export const SIDEBAR_KEY_STEP = 16
export const COLLAPSED_GUTTER = 36
export const PEEK_EDGE_ZONE = 8
export const PEEK_OPEN_DELAY_MS = 150
export const PEEK_CLOSE_GRACE_MS = 300

const WIDTH_KEY = "opencv.sidebar.width"
const COLLAPSED_KEY = "opencv.sidebar.collapsed"

export function clampSidebarWidth(width: number) {
  if (!Number.isFinite(width)) return DEFAULT_SIDEBAR_WIDTH
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))
}

export function isCollapseDrag(width: number) {
  return width < COLLAPSE_BELOW_WIDTH
}

function parseWidth(raw: string | null) {
  if (raw === null) return DEFAULT_SIDEBAR_WIDTH
  return clampSidebarWidth(Number(raw))
}

export function readSidebarWidth() {
  return readStored(WIDTH_KEY, parseWidth, DEFAULT_SIDEBAR_WIDTH)
}

export function writeSidebarWidth(width: number) {
  writeStored(WIDTH_KEY, String(Math.round(clampSidebarWidth(width))))
}

export function readSidebarCollapsed() {
  return readStored(COLLAPSED_KEY, (raw) => raw === "1", false)
}

export function writeSidebarCollapsed(collapsed: boolean) {
  writeStored(COLLAPSED_KEY, collapsed ? "1" : "0")
}
