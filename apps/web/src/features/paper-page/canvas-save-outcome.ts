import type { WordPage } from "@workspace/domain"

import {
  pageBlocks,
  type DraftBasis,
  type WritingBlock,
  type WritingDraft,
} from "./canvas-edit.ts"
import {
  uniqueRefusals,
  type LineRefusal,
  type PageBlock,
} from "./canvas-save-lines.ts"

export type SaveOutcome = {
  local?: boolean
  saved: boolean
  words: string
  revision: string | null
  note: string | null
  blocks?: WritingBlock[]
  basis?: DraftBasis
  head?: WritingBlock[]
  renamed?: Record<string, string>
  replace?: WritingDraft
  conflict?: boolean
  moved?: MovedPage
  refusedLines?: LineRefusal[]
  pageRefusal?: string | null
}

export type MovedPage = { basis: DraftBasis; head: WritingBlock[] }

export function missed(words: string): SaveOutcome {
  return { saved: false, words, revision: null, note: null }
}

export function pageText(page: WordPage) {
  return pageBlocks(page)
    .map((block) => block.text)
    .join("\n")
}

export function adoptedBlocks(page: WordPage, blocks: readonly PageBlock[]) {
  const next = pageBlocks(page)
  if (next.length !== blocks.length) return undefined
  const same = next.every(
    (block, index) =>
      block.text === blocks[index]?.text &&
      !!block.held === !!blocks[index]?.held
  )
  return same ? next : undefined
}

export function headOf(page: WordPage) {
  return {
    basis: recordedBasis(page.revision, pageText(page)),
    head: pageBlocks(page),
  }
}

export function movedTo(words: string, page: WordPage): SaveOutcome {
  return {
    saved: false,
    words,
    revision: null,
    note: null,
    conflict: true,
    moved: headOf(page),
  }
}

export function withRenames(
  outcome: SaveOutcome,
  renames: Record<string, string>
): SaveOutcome {
  return Object.keys(renames).length > 0
    ? { ...outcome, renamed: renames }
    : outcome
}

export function withRefusals(
  outcome: SaveOutcome,
  refusals: readonly LineRefusal[]
): SaveOutcome {
  return refusals.length > 0
    ? { ...outcome, refusedLines: uniqueRefusals(refusals) }
    : outcome
}

export function renamedBlocks(
  blocks: readonly PageBlock[],
  renames: Record<string, string>
): PageBlock[] {
  return blocks.map((block) => {
    const id = renames[block.id]
    return id ? { ...block, id } : block
  })
}

export function recordedBasis(revision: string, words: string): DraftBasis {
  return { revision, words }
}
