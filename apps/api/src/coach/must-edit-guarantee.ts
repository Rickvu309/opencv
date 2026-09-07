import {
  ERROR_CODES,
  errorEnvelope,
  type CoachFocusDoc,
} from "@workspace/domain"

import {
  isRecoverableUpdateFailure,
  isSuccessfulToolOutput,
  MUST_EDIT_APPLY_FAILED_COPY,
  repairPaperUpdateInput,
  toolFailureMessage,
} from "./must-edit-repair.js"
import {
  MUST_EDIT_TOOLS,
  applyRewriteToFocusContent,
  findFocusRewriteOriginal,
  isPaperEditAsk,
  isRealRewrite,
  localRewriteText,
  mustEditMissCopy,
  mustEditNoRewriteCopy,
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
  ) => string | null | Promise<string | null>
  toolCallId?: string
}

type ToolCallEvent = Extract<ModelStreamEvent, { type: "tool-call" }>
type ToolResultEvent = Extract<ModelStreamEvent, { type: "tool-result" }>
type ToolErrorEvent = Extract<ModelStreamEvent, { type: "tool-error" }>

/**
 * After the model loop, an edit ask that only read (or spoke) still has to
 * attempt paper_updateContent. Advice turns never enter this path.
 *
 * Failed version / invalid-input receipts are held: retry once with a
 * repaired contentVersion + sanitized body, or emit one honest failure.
 * A later successful Updated CV receipt never follows those error flashes.
 */
export async function* guaranteeMustEditStream(
  events: AsyncIterable<ModelStreamEvent>,
  options: MustEditGuaranteeOptions
): AsyncGenerator<ModelStreamEvent> {
  const calledTools: string[] = []
  let sawText = false
  let finish: Extract<ModelStreamEvent, { type: "finish" }> | undefined
  const isMustEdit = isPaperEditAsk(options.userText, options.hasFocusDoc)
  let updateSucceeded = false
  let heldRecoverable = false
  let pendingCall: ToolCallEvent | undefined
  let lastFailedInput: unknown

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

    if (
      isMustEdit &&
      event.type === "tool-call" &&
      event.name === MUST_EDIT_TOOLS.updateContent
    ) {
      if (pendingCall) yield pendingCall
      pendingCall = event
      continue
    }

    if (
      isMustEdit &&
      pendingCall &&
      (event.type === "tool-result" || event.type === "tool-error") &&
      event.toolCallId === pendingCall.toolCallId
    ) {
      const settled = classifyUpdateAttempt(
        pendingCall,
        event,
        updateSucceeded
      )
      pendingCall = undefined
      if (settled.kind === "success") {
        updateSucceeded = true
        heldRecoverable = false
        yield settled.call
        yield settled.result
        continue
      }
      if (settled.kind === "held") {
        heldRecoverable = true
        lastFailedInput = settled.input
        continue
      }
      yield settled.call
      yield settled.result
      continue
    }

    if (pendingCall) {
      yield pendingCall
      pendingCall = undefined
    }
    yield event
  }

  if (pendingCall) yield pendingCall

  if (
    !updateSucceeded &&
    mustEditStillNeedsUpdate({
      userText: options.userText,
      hasFocusDoc: options.hasFocusDoc,
      calledTools,
    })
  ) {
    yield* completeMustEdit(options, sawText)
  } else if (!updateSucceeded && heldRecoverable) {
    const retried = await retryRepairedUpdate(lastFailedInput, options)
    if (retried) {
      yield retried.call
      yield retried.result
    } else {
      yield* completeMustEdit(options, sawText, {
        alreadyAttempted: true,
      })
    }
  }

  if (finish) yield finish
}

function classifyUpdateAttempt(
  call: ToolCallEvent,
  event: ToolResultEvent | ToolErrorEvent,
  alreadySucceeded: boolean
):
  | { kind: "success"; call: ToolCallEvent; result: ToolResultEvent }
  | { kind: "held"; input: unknown }
  | {
      kind: "emit"
      call: ToolCallEvent
      result: ToolResultEvent | ToolErrorEvent
    } {
  if (event.type === "tool-result" && isSuccessfulToolOutput(event.output)) {
    return { kind: "success", call, result: event }
  }

  const message =
    event.type === "tool-error"
      ? toolFailureMessage(event.error)
      : toolFailureMessage(event.output)

  if (!isRecoverableUpdateFailure(message) || alreadySucceeded) {
    return { kind: "emit", call, result: event }
  }

  return { kind: "held", input: call.input }
}

async function retryRepairedUpdate(
  input: unknown,
  options: MustEditGuaranteeOptions
): Promise<{ call: ToolCallEvent; result: ToolResultEvent } | null> {
  const repaired = repairPaperUpdateInput(input, options.focusDoc)
  if (!repaired) return null

  try {
    const output = await options.executeUpdate(repaired)
    if (!isSuccessfulToolOutput(output)) return null
    const toolCallId = options.toolCallId ?? `must-edit-${Date.now()}`
    return {
      call: {
        type: "tool-call",
        toolCallId,
        name: MUST_EDIT_TOOLS.updateContent,
        input: repaired,
      },
      result: {
        type: "tool-result",
        toolCallId,
        name: MUST_EDIT_TOOLS.updateContent,
        output,
      },
    }
  } catch {
    return null
  }
}

async function* completeMustEdit(
  options: MustEditGuaranteeOptions,
  sawText: boolean,
  extras?: { alreadyAttempted?: boolean }
): AsyncGenerator<ModelStreamEvent> {
  const toolCallId = options.toolCallId ?? `must-edit-${Date.now()}`
  const doc = options.focusDoc
  const original = doc
    ? findFocusRewriteOriginal(doc, options.userText, options.selectionText)
    : null

  if (!doc || !original) {
    const miss = extras?.alreadyAttempted
      ? {
          receipt: MUST_EDIT_APPLY_FAILED_COPY,
          nextStep: applyFailedNextStep(doc),
        }
      : mustEditMissCopy(doc, options.userText)
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
      output: errorEnvelope(ERROR_CODES.VALIDATION_ERROR, miss.receipt),
    }
    if (!sawText) {
      yield {
        type: "text-delta",
        text: miss.nextStep,
      }
    }
    return
  }

  const replacement = await Promise.resolve(
    options.rewriteText
      ? options.rewriteText(original, options.userText)
      : localRewriteText(original, options.userText)
  )
  if (!isRealRewrite(original, replacement)) {
    const miss = extras?.alreadyAttempted
      ? {
          receipt: MUST_EDIT_APPLY_FAILED_COPY,
          nextStep: applyFailedNextStep(doc),
        }
      : mustEditNoRewriteCopy()
    yield {
      type: "tool-call",
      toolCallId,
      name: MUST_EDIT_TOOLS.updateContent,
      input: {
        docId: doc.id,
        contentVersion: doc.contentVersion,
        content: doc.content,
      },
    }
    yield {
      type: "tool-result",
      toolCallId,
      name: MUST_EDIT_TOOLS.updateContent,
      output: errorEnvelope(ERROR_CODES.VALIDATION_ERROR, miss.receipt),
    }
    if (!sawText) {
      yield {
        type: "text-delta",
        text: miss.nextStep,
      }
    }
    return
  }

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
    const miss = extras?.alreadyAttempted
      ? {
          receipt: MUST_EDIT_APPLY_FAILED_COPY,
          nextStep: applyFailedNextStep(doc),
        }
      : mustEditMissCopy(doc, options.userText)
    yield {
      type: "tool-result",
      toolCallId,
      name: MUST_EDIT_TOOLS.updateContent,
      output: errorEnvelope(ERROR_CODES.VALIDATION_ERROR, miss.receipt),
    }
    if (!sawText) {
      yield {
        type: "text-delta",
        text: miss.nextStep,
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

function applyFailedNextStep(doc?: CoachFocusDoc): string {
  if (!doc) {
    return "Could not apply the rewrite. Next step: try sending the ask again."
  }
  return `Could not update ${doc.name}. Next step: try sending the rewrite again.`
}
