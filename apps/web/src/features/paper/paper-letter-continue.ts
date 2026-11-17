import type { QueryClient } from "@tanstack/react-query"
import { paperCanvasCommitSchema, type WordPage } from "@workspace/domain"

import {
  loadDraft,
  pageBlocks,
  type WritingBlock,
} from "@/features/paper-page/canvas-edit.ts"
import { pageWords } from "@/features/paper-page/canvas-save.ts"
import { readWordPage } from "@/features/paper-page/package-read.ts"
import { diffParagraphs } from "@/features/paper-page/page-diff.ts"
import type { useRunCommand } from "@/lib/contract-client.ts"
import { isAbortError } from "@/lib/sse.ts"
import { notifyWritingRefresh } from "@/lib/writing-refresh.ts"

import { followPaperTurn, stopPaperChat, streamPaperTurn } from "./paper-api.ts"
import { letterLines } from "./paper-letter-start.tsx"
import {
  clearStoppedLetter,
  type StoppedLetter,
} from "./paper-letter-resume.ts"

const DRAFT_FAILED = "Could not draft the letter. Try again."
const READ_FAILED = "Could not read this page. Try again."
const PAGE_EDITED =
  "Coach's draft was not applied because you edited this page. Your text is unchanged."

type Run = ReturnType<typeof useRunCommand>

export function blocksForLetterLines(
  page: WordPage,
  lines: readonly string[]
): WritingBlock[] {
  const blocks = pageBlocks(page).map((block) => ({ ...block }))
  const first = blocks.findIndex((block) => !block.held)
  const extras = lines.slice(first === -1 ? 0 : 1).map((text, index) => ({
    id: `draft-line-${index + 1}`,
    text,
  }))
  if (first === -1) return [...blocks, ...extras]
  blocks[first] = { ...blocks[first], text: lines[0] ?? "" }
  blocks.splice(first + 1, 0, ...extras)
  return blocks
}

export async function redraftStoppedLetter(input: {
  record: StoppedLetter
  owner: string
  email?: string
  queryClient: QueryClient
  run: Run
  signal: AbortSignal
  onWritten?: (text: string) => void
  isBlank: () => boolean
}) {
  if (input.signal.aborted) return
  const assertBlank = () => {
    const draft = loadDraft(input.record.docId, localStorage)
    if (
      !input.isBlank() ||
      (draft && pageWords(draft.blocks).trim().length > 0)
    ) {
      clearStoppedLetter(input.record.docId)
      throw new Error(PAGE_EDITED)
    }
  }
  assertBlank()
  if (!input.onWritten && input.owner === "") throw new Error(READ_FAILED)
  const chat = { id: input.record.chatId }
  let text = ""
  try {
    const end = await streamPaperTurn({
      queryClient: input.queryClient,
      chatId: chat.id,
      text: input.record.prompt,
      context: input.record.jobId
        ? [{ kind: "job", id: input.record.jobId }]
        : undefined,
      textOnly: true,
      signal: input.signal,
      onText: (delta) => {
        text += delta
      },
    })
    if (input.signal.aborted) {
      void stopPaperChat(chat.id)
      return
    }
    if (end === "continuing") {
      text = await followPaperTurn({
        queryClient: input.queryClient,
        chatId: chat.id,
        signal: input.signal,
        onText: (full) => {
          text = full
        },
        onWaiting: () => undefined,
      })
    }
  } catch (error) {
    if (isAbortError(error) || input.signal.aborted) {
      void stopPaperChat(chat.id)
      return
    }
    void stopPaperChat(chat.id)
    throw error
  }
  if (input.signal.aborted) {
    void stopPaperChat(chat.id)
    return
  }
  const lines = letterLines(text, input.email)
  if (lines.length === 0) throw new Error(DRAFT_FAILED)
  assertBlank()
  if (input.onWritten) {
    input.onWritten(text)
    clearStoppedLetter(input.record.docId)
    return
  }
  const page = await readWordPage(input.owner, input.record.docId, input.signal)
  if (!page) throw new Error(READ_FAILED)
  if (page.paragraphs.some((paragraph) => paragraph.text.trim().length > 0)) {
    clearStoppedLetter(input.record.docId)
    throw new Error(PAGE_EDITED)
  }
  assertBlank()
  const diff = diffParagraphs(page, blocksForLetterLines(page, lines), null)
  if ("refused" in diff) throw new Error(diff.refused)
  if (diff.ops.length === 0) {
    clearStoppedLetter(input.record.docId)
    return
  }
  const parsed = paperCanvasCommitSchema.safeParse({
    op: "write",
    batch: { doc: page.doc, basedOn: page.revision, ops: diff.ops },
  })
  if (!parsed.success || parsed.data.op !== "write")
    throw new Error(DRAFT_FAILED)
  const startedDraft = JSON.stringify(
    loadDraft(input.record.docId, localStorage)
  )
  await input.run("paper.canvas", parsed.data, { signal: input.signal })
  assertBlank()
  if (
    JSON.stringify(loadDraft(input.record.docId, localStorage)) !== startedDraft
  ) {
    clearStoppedLetter(input.record.docId)
    throw new Error(PAGE_EDITED)
  }
  clearStoppedLetter(input.record.docId)
  notifyWritingRefresh()
}
