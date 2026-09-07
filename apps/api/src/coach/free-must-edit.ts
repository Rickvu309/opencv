import type { CoachFocusDoc } from "@workspace/domain"

import { guaranteeMustEditStream } from "./must-edit-guarantee.js"
import {
  extractMustEditReplacement,
  findFocusRewriteOriginal,
  shouldUseFreeTextMustEdit,
} from "./must-edit.js"
import type { ModelStreamEvent, ModelUsage } from "./translate.js"

export { shouldUseFreeTextMustEdit }

export type FreeTextMustEditGenerateLine = (input: {
  original: string
  userText: string
}) => Promise<
  | { text: string; finish?: Extract<ModelStreamEvent, { type: "finish" }> }
  | { error: string }
  | { abort: true }
>

export type FreeTextMustEditOptions = {
  userText: string
  hasFocusDoc: boolean
  focusDoc?: CoachFocusDoc
  selectionText?: string
  executeUpdate: (input: {
    docId: string
    content: unknown
    contentVersion: number
  }) => Promise<unknown>
  generateLine?: FreeTextMustEditGenerateLine
  toolCallId?: string
}

/**
 * Free focus-doc must-edit without tools. The model returns one rewritten
 * line; the runtime applies paper_updateContent. A provider 402/429 is
 * surfaced honestly — this path does not invent scout rewrite copy.
 */
export async function* runFreeTextMustEdit(
  options: FreeTextMustEditOptions
): AsyncGenerator<ModelStreamEvent> {
  const original = options.focusDoc
    ? findFocusRewriteOriginal(
        options.focusDoc,
        options.userText,
        options.selectionText
      )
    : null

  if (!original || !options.generateLine) {
    yield* guaranteeMustEditStream(finishOnly(), guaranteeOptions(options))
    return
  }

  const generated = await options.generateLine({
    original,
    userText: options.userText,
  })
  if ("abort" in generated) {
    yield { type: "abort" }
    return
  }
  if ("error" in generated) {
    yield { type: "error", message: generated.error }
    return
  }

  const replacement = extractMustEditReplacement(generated.text, original)
  yield* guaranteeMustEditStream(finishOnly(generated.finish), {
    ...guaranteeOptions(options),
    rewriteText: () => replacement,
  })
}

function guaranteeOptions(options: FreeTextMustEditOptions) {
  return {
    userText: options.userText,
    hasFocusDoc: options.hasFocusDoc,
    focusDoc: options.focusDoc,
    selectionText: options.selectionText,
    executeUpdate: options.executeUpdate,
    toolCallId: options.toolCallId,
  }
}

async function* finishOnly(
  finish?: Extract<ModelStreamEvent, { type: "finish" }>
): AsyncGenerator<ModelStreamEvent> {
  yield (
    finish ?? {
      type: "finish" as const,
      finishReason: "stop",
      usage: {} satisfies ModelUsage,
    }
  )
}
