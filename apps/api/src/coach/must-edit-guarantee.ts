import {
  ERROR_CODES,
  errorEnvelope,
  type CoachFocusDoc,
} from "@workspace/domain"

import {
  MUST_EDIT_TOOLS,
  applyRewriteToFocusContent,
  findFocusRewriteOriginal,
  localRewriteText,
  mustEditStillNeedsUpdate,
} from "./must-edit.js"
import type { ModelStreamEvent } from "./translate.js"

export type MustEditGuaranteeOptions = {
  userText: string
  hasFocusDoc: boolean
  focusDoc?: CoachFocusDoc
  selectionText?: string
  executeUpdate: (input: {
    docId: string
    content: unknown
    contentVersion: number
  }) => Promise<unknown>
  rewriteText?: (
    original: string,
    userText: string
  ) => string | Promise<string>
  toolCallId?: string
}

/**
 * After the model loop, an edit ask that only read (or spoke) still has to
 * attempt paper_updateContent. Advice turns never enter this path.
 */
export async function* guaranteeMustEditStream(
  events: AsyncIterable<ModelStreamEvent>,
  options: MustEditGuaranteeOptions
): AsyncGenerator<ModelStreamEvent> {
  const calledTools: string[] = []
  let sawText = false
  let finish: Extract<ModelStreamEvent, { type: "finish" }> | undefined

  for await (const event of events) {
    if (event.type === "tool-call") calledTools.push(event.name)
    if (event.type === "text-delta" && event.text.length > 0) sawText = true
    if (event.type === "finish") {
      finish = event
      continue
    }
    if (event.type === "error" || event.type === "abort") {
      yield event
      return
    }
    yield event
  }

  if (
    mustEditStillNeedsUpdate({
      userText: options.userText,
      hasFocusDoc: options.hasFocusDoc,
      calledTools,
    })
  ) {
    yield* completeMustEdit(options, sawText)
  }

  if (finish) yield finish
}

async function* completeMustEdit(
  options: MustEditGuaranteeOptions,
  sawText: boolean
): AsyncGenerator<ModelStreamEvent> {
  const toolCallId = options.toolCallId ?? `must-edit-${Date.now()}`
  const doc = options.focusDoc
  const original = doc
    ? findFocusRewriteOriginal(doc, options.userText, options.selectionText)
    : null

  if (!doc || !original) {
    yield {
      type: "tool-call",
      toolCallId,
      name: MUST_EDIT_TOOLS.updateContent,
      input: doc
        ? {
            docId: doc.id,
            contentVersion: doc.contentVersion,
            content: doc.content,
          }
        : {},
    }
    yield {
      type: "tool-result",
      toolCallId,
      name: MUST_EDIT_TOOLS.updateContent,
      output: errorEnvelope(
        ERROR_CODES.VALIDATION_ERROR,
        "Could not apply the rewrite to the open document."
      ),
    }
    if (!sawText) {
      yield {
        type: "text-delta",
        text: "Could not update the open document. Next step: name the section or bullet to change.",
      }
    }
    return
  }

  const replacement = await Promise.resolve(
    options.rewriteText
      ? options.rewriteText(original, options.userText)
      : localRewriteText(original, options.userText)
  )
  const content = applyRewriteToFocusContent(
    doc,
    options.userText,
    replacement,
    options.selectionText
  )
  const input = {
    docId: doc.id,
    contentVersion: doc.contentVersion,
    content: content ?? doc.content,
  }

  yield {
    type: "tool-call",
    toolCallId,
    name: MUST_EDIT_TOOLS.updateContent,
    input,
  }

  if (!content) {
    yield {
      type: "tool-result",
      toolCallId,
      name: MUST_EDIT_TOOLS.updateContent,
      output: errorEnvelope(
        ERROR_CODES.VALIDATION_ERROR,
        "Could not apply the rewrite to the open document."
      ),
    }
    if (!sawText) {
      yield {
        type: "text-delta",
        text: "Could not update the open document. Next step: name the section or bullet to change.",
      }
    }
    return
  }

  try {
    const output = await options.executeUpdate(input)
    yield {
      type: "tool-result",
      toolCallId,
      name: MUST_EDIT_TOOLS.updateContent,
      output,
    }
    if (!sawText) {
      yield {
        type: "text-delta",
        text: `Updated ${doc.name}. Next step: read the changed line and send another ask if you want a different angle.`,
      }
    }
  } catch (error) {
    yield {
      type: "tool-error",
      toolCallId,
      name: MUST_EDIT_TOOLS.updateContent,
      error,
    }
    if (!sawText) {
      yield {
        type: "text-delta",
        text: `Could not update ${doc.name}. Next step: try sending the rewrite again.`,
      }
    }
  }
}
