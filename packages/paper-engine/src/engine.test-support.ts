import type {
  Block,
  BlockId,
  Document,
  Origin,
  Run,
} from "@workspace/domain/paper-doc"
import { paperEngineBlank } from "@workspace/domain/paper-doc"

import { createEngine, fixedClock, seededIds } from "./index.js"

export const person: Origin = { kind: "person", actor: "p1", client: "tab-1" }
export const coach: Origin = { kind: "coach", actor: "coach", client: "srv" }

export type BlockSpec = {
  runs?: Run[]
  text?: string
  list?: "bullet" | "numbered" | null
  level?: number
}

export function textBlock(id: string, spec: BlockSpec = {}): Block {
  const runs =
    spec.runs ?? (spec.text ? [{ type: "text", text: spec.text }] : [])
  return {
    type: "text_block",
    attrs: {
      id: id as BlockId,
      kind: "paragraph",
      list: spec.list ?? null,
      level: (spec.level ?? 0) as 0,
      align: "left",
      lineSpacing: null,
      keepWithNext: null,
    },
    ...(runs.length ? { content: runs } : {}),
  }
}

export function paperOf(blocks: Block[]): Document {
  return { ...paperEngineBlank.blankCv(), content: blocks }
}

export function newEngine() {
  return createEngine({ ids: seededIds("new"), now: fixedClock() })
}
