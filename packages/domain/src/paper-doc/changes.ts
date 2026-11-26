import type { PaperNodeType } from "./nodes.js"

export type PaperChange = {
  readonly blockId: string
  readonly change: "added" | "changed" | "moved" | "removed"
  readonly kind: PaperNodeType
  readonly before?: string
  readonly after?: string
}
