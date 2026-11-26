import type { QueryClient } from "@tanstack/react-query"

import { isAbortError } from "@/lib/sse.ts"

import { followPaperTurn, stopPaperChat, streamPaperTurn } from "./paper-api.ts"
import { letterLines } from "./paper-letter-start.tsx"
import {
  clearStoppedLetter,
  type StoppedLetter,
} from "./paper-letter-resume.ts"

const DRAFT_FAILED = "Could not draft the letter. Try again."
const PAGE_EDITED =
  "Coach's draft was not applied because you edited this page. Your text is unchanged."

export async function redraftStoppedLetter(input: {
  record: StoppedLetter
  owner: string
  email?: string
  queryClient: QueryClient
  signal: AbortSignal
  onWritten: (text: string) => void | Promise<void>
  isBlank: () => boolean
}) {
  if (input.signal.aborted) return
  const assertBlank = () => {
    if (!input.isBlank()) {
      clearStoppedLetter(input.record.docId)
      throw new Error(PAGE_EDITED)
    }
  }
  assertBlank()
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
      void stopPaperChat(input.queryClient, chat.id)
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
      void stopPaperChat(input.queryClient, chat.id)
      return
    }
    void stopPaperChat(input.queryClient, chat.id)
    throw error
  }
  if (input.signal.aborted) {
    void stopPaperChat(input.queryClient, chat.id)
    return
  }
  const lines = letterLines(text, input.email)
  if (lines.length === 0) throw new Error(DRAFT_FAILED)
  assertBlank()
  await input.onWritten(text)
  clearStoppedLetter(input.record.docId)
}
