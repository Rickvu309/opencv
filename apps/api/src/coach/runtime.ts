import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import {
  APPLY_SCAN_SYSTEM_PROMPT,
  COACH_STEP_CAP,
  coachProviderErrorMessage,
  DEFAULT_COACH_MAX_OUTPUT_TOKENS,
  DEFAULT_COACH_MODEL,
  DEFAULT_COACH_MODE,
  ERROR_CODES,
  errorEnvelope,
  resolveCoachModel,
  type ApplyScanExtractInput,
  type CoachRuntime,
  type CoachTitleInput,
  type CoachTurnInput,
} from "@workspace/domain"
import { asSchema, generateText, stepCountIs, streamText, tool, type ToolSet } from "ai"

import { listApplyCardsForUser } from "../apply/queries.js"
import {
  commandRegistry,
  type AppDatabase,
  type CommandRegistry,
} from "../commands/index.js"
import { listPaperDocsForUser } from "../paper/queries.js"
import { getPitchDocForUser, toPitchDoc } from "../pitch/queries.js"
import { getProfileForUser } from "../profile/queries.js"
import { runFreeTextMustEdit } from "./free-must-edit.js"
import { guaranteeMustEditStream } from "./must-edit-guarantee.js"
import {
  paperUpdateContentCoachInputSchema,
  repairPaperUpdateInput,
} from "./must-edit-repair.js"
import {
  MUST_EDIT_TOOLS,
  freeMustEditLinePrompt,
  latestUserText,
  mustEditPrepareStep,
  shouldUseFreeTextMustEdit,
  toolNamesFromSteps,
} from "./must-edit.js"
import {
  assembleSystemPrompt,
  historyForRegenerate,
  snapshotFromLists,
  windowHistory,
} from "./prompt.js"
import { withApplyCardIdGuard } from "./apply-card-guard.js"
import {
  isPitchCoachAsk,
  omitApplyMutations,
} from "./pitch-scope.js"
import { reversalForTool } from "./receipts.js"
import {
  partsFromModelStream,
  type ModelStreamEvent,
  type ModelUsage,
} from "./translate.js"
import { THREAD_TITLE_SYSTEM_PROMPT, threadTitleUserPrompt } from "./title.js"
import { assembleCoachTools, type CoachToolSurface } from "./tools.js"

export type OpenRouterCoachRuntimeOptions = {
  apiKey: string
  model?: string
  /** Light-tier model for first-turn History titles (QVE-153 / ADR-0009). */
  titleModel?: string
  db: AppDatabase
  registry?: CommandRegistry
  maxOutputTokens?: number
}

/**
 * OpenRouter-backed CoachRuntime. This is the only module that imports
 * the AI SDK (ADR-0007).
 */
export function createOpenRouterCoachRuntime({
  apiKey,
  model = DEFAULT_COACH_MODEL,
  titleModel = resolveCoachModel("light"),
  db,
  registry = commandRegistry,
  maxOutputTokens = DEFAULT_COACH_MAX_OUTPUT_TOKENS,
}: OpenRouterCoachRuntimeOptions): CoachRuntime {
  const openrouter = createOpenRouter({
    apiKey,
    compatibility: "strict",
    appName: "OpenPath",
    appUrl: "https://openpath-app.vercel.app",
  })

  return {
    async generateTitle({ userText, coachText }: CoachTitleInput) {
      const result = await generateText({
        model: openrouter(titleModel),
        system: THREAD_TITLE_SYSTEM_PROMPT,
        prompt: threadTitleUserPrompt(userText, coachText),
        maxOutputTokens: 64,
      })
      return result.text
    },
    async scanJobPosting({ postingText }: ApplyScanExtractInput) {
      const result = await generateText({
        model: openrouter(resolveCoachModel("free")),
        system: APPLY_SCAN_SYSTEM_PROMPT,
        prompt: postingText,
        maxOutputTokens: 200,
      })
      return result.text
    },
    async *streamTurn(input: CoachTurnInput) {
      const startedAt = Date.now()
      const abort = new AbortController()
      const turnModel = input.model ?? model
      const snapshot = {
        ...(await loadWorkspaceSnapshot(db, input.userId)),
        ...(input.focusDoc ? { focusDoc: input.focusDoc } : {}),
      }
      const prepared = input.regenerate
        ? historyForRegenerate(input.history)
        : { history: input.history, priorCoach: undefined }
      const messages = windowHistory(prepared.history)
      const userText =
        latestUserText(messages) ||
        latestUserText(
          prepared.history.map((message) => ({
            role: message.role === "user" ? "user" : "assistant",
            content: message.text,
          }))
        )
      const hasFocusDoc = Boolean(input.focusDoc)
      const coachTools = assembleTurnCoachTools({
        db,
        userId: input.userId,
        registry,
        focusDoc: input.focusDoc,
        userText,
      })
      const tools = toAiSdkTools(coachTools)
      const executeUpdate = (updateInput: {
        docId: string
        content: unknown
        contentVersion: number
      }) => {
        const update = coachTools[MUST_EDIT_TOOLS.updateContent]
        if (!update) {
          return Promise.resolve(
            errorEnvelope(
              ERROR_CODES.VALIDATION_ERROR,
              "paper_updateContent is unavailable"
            )
          )
        }
        return update.execute(updateInput)
      }

      const mode = input.mode ?? DEFAULT_COACH_MODE

      try {
        if (
          shouldUseFreeTextMustEdit({
            mode,
            userText,
            hasFocusDoc,
          }) &&
          input.focusDoc
        ) {
          const focusDoc = input.focusDoc
          yield* partsFromModelStream(
            runFreeTextMustEdit({
              userText,
              hasFocusDoc,
              focusDoc,
              selectionText: input.selection?.text,
              executeUpdate,
              generateLine: async ({ original }) => {
                const result = streamText({
                  model: openrouter(turnModel, { usage: { include: true } }),
                  system: freeMustEditLinePrompt({
                    original,
                    userText,
                    docName: focusDoc.name,
                  }),
                  prompt: userText,
                  maxOutputTokens: 256,
                  abortSignal: abort.signal,
                })
                let text = ""
                let finish:
                  | Extract<ModelStreamEvent, { type: "finish" }>
                  | undefined
                for await (const event of normalizeFullStream(
                  result.fullStream,
                  mode
                )) {
                  if (event.type === "text-delta") text += event.text
                  if (event.type === "error") return { error: event.message }
                  if (event.type === "abort") return { abort: true as const }
                  if (event.type === "finish") finish = event
                }
                return { text, ...(finish ? { finish } : {}) }
              },
            }),
            {
              model: turnModel,
              startedAt,
              reversalFor: (name) => reversalForTool(name, registry),
            }
          )
          return
        }

        const result = streamText({
          model: openrouter(turnModel, { usage: { include: true } }),
          system: assembleSystemPrompt(
            snapshot,
            undefined,
            {
              ...(input.regenerate
                ? { regenerateFrom: prepared.priorCoach }
                : {}),
              ...(input.selection ? { selection: input.selection } : {}),
              ...(userText ? { latestUserText: userText } : {}),
            }
          ),
          messages,
          tools,
          stopWhen: stepCountIs(COACH_STEP_CAP),
          maxOutputTokens,
          abortSignal: abort.signal,
          prepareStep({ steps }) {
            return mustEditPrepareStep({
              userText,
              hasFocusDoc,
              calledTools: toolNamesFromSteps(steps),
            })
          },
        })

        yield* partsFromModelStream(
          guaranteeMustEditStream(
            normalizeFullStream(result.fullStream, mode),
            {
              userText,
              hasFocusDoc,
              focusDoc: input.focusDoc,
              selectionText: input.selection?.text,
              executeUpdate,
            }
          ),
          {
            model: turnModel,
            startedAt,
            reversalFor: (name) => reversalForTool(name, registry),
          }
        )
      } finally {
        abort.abort()
      }
    },
  }
}

/** Per-turn surface: Pitch café asks drop Apply mutations (QVE-247). */
export function assembleTurnCoachTools({
  db,
  userId,
  registry = commandRegistry,
  focusDoc,
  userText,
}: {
  db: AppDatabase
  userId: string
  registry?: CommandRegistry
  focusDoc?: CoachTurnInput["focusDoc"]
  userText: string
}): CoachToolSurface {
  const pitchScoped = isPitchCoachAsk(userText)
  return withApplyCardIdGuard(
    withMustEditRepair(
      omitApplyMutations(
        assembleCoachTools({ db, userId, registry }),
        pitchScoped
      ),
      focusDoc
    ),
    { pitchScoped }
  )
}

async function loadWorkspaceSnapshot(db: AppDatabase, userId: string) {
  const [profile, paper, apply, pitchRow] = await Promise.all([
    getProfileForUser(db, userId).catch(() => null),
    listPaperDocsForUser(db, userId).catch(() => []),
    listApplyCardsForUser(db, userId).catch(() => []),
    getPitchDocForUser(db, userId).catch(() => null),
  ])
  const pitch = pitchRow ? toPitchDoc(pitchRow).content : null
  return snapshotFromLists({ profile, paper, apply, pitch })
}

export function withMustEditRepair(
  surface: CoachToolSurface,
  focusDoc?: CoachTurnInput["focusDoc"]
): CoachToolSurface {
  const update = surface[MUST_EDIT_TOOLS.updateContent]
  if (!update) return surface
  return {
    ...surface,
    [MUST_EDIT_TOOLS.updateContent]: {
      description: update.description,
      inputSchema: paperUpdateContentCoachInputSchema,
      execute: async (input) => {
        const repaired = repairPaperUpdateInput(input, focusDoc)
        return update.execute(repaired ?? input)
      },
    },
  }
}

/**
 * Convert a Coach tool input into the Schema object streamText later reuses.
 * Accessing `.jsonSchema` is the live path (`prepareToolsAndToolChoice`).
 * A `{ safeParse }` stub has no `~standard`, so `asSchema` calls `schema()`
 * and throws "schema is not a function" (QVE-196).
 */
export function jsonSchemaForCoachInput(schema: unknown) {
  return asSchema(schema as never).jsonSchema
}

export function toAiSdkTools(surface: CoachToolSurface): ToolSet {
  const tools: ToolSet = {}
  for (const [name, coachTool] of Object.entries(surface)) {
    const inputSchema = asSchema(coachTool.inputSchema as never)
    // Force conversion now and pass the Schema object into tool(), so
    // streamText never sees a raw stub (QVE-196).
    void inputSchema.jsonSchema
    tools[name] = tool({
      description: coachTool.description,
      inputSchema,
      execute: async (input) => coachTool.execute(input),
    })
  }
  return tools
}

export async function* normalizeFullStream(
  fullStream: AsyncIterable<{ type: string } & Record<string, unknown>>,
  mode = DEFAULT_COACH_MODE
): AsyncGenerator<ModelStreamEvent> {
  let pendingCost: number | undefined
  let pendingModelId: string | undefined

  for await (const part of fullStream) {
    switch (part.type) {
      case "text-delta":
        if (typeof part.text === "string" && part.text.length > 0) {
          yield { type: "text-delta", text: part.text }
        }
        break
      case "tool-call":
        if (
          typeof part.toolCallId === "string" &&
          typeof part.toolName === "string"
        ) {
          yield {
            type: "tool-call",
            toolCallId: part.toolCallId,
            name: part.toolName,
            input: part.input,
          }
        }
        break
      case "tool-result":
        if (
          typeof part.toolCallId === "string" &&
          typeof part.toolName === "string"
        ) {
          yield {
            type: "tool-result",
            toolCallId: part.toolCallId,
            name: part.toolName,
            output: part.output,
          }
        }
        break
      case "tool-error":
        if (
          typeof part.toolCallId === "string" &&
          typeof part.toolName === "string"
        ) {
          yield {
            type: "tool-error",
            toolCallId: part.toolCallId,
            name: part.toolName,
            error: part.error,
          }
        }
        break
      case "finish-step":
        pendingCost =
          costFromUnknown(part.providerMetadata) ??
          costFromUsage(part.usage) ??
          pendingCost
        pendingModelId = modelIdFromResponse(part.response) ?? pendingModelId
        break
      case "finish":
        yield {
          type: "finish",
          finishReason:
            typeof part.finishReason === "string" ? part.finishReason : "stop",
          usage: usageFromUnknown(part.totalUsage, pendingCost),
          ...(pendingModelId ? { model: pendingModelId } : {}),
        }
        return
      case "error":
        yield {
          type: "error",
          message: coachProviderErrorMessage(part.error, mode),
        }
        return
      case "abort":
        yield { type: "abort" }
        return
      default:
        break
    }
  }
}

function modelIdFromResponse(response: unknown): string | undefined {
  if (!response || typeof response !== "object") return undefined
  const modelId = (response as { modelId?: unknown }).modelId
  if (typeof modelId !== "string") return undefined
  const trimmed = modelId.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function usageFromUnknown(
  usage: unknown,
  pendingCost?: number
): ModelUsage {
  const row =
    usage && typeof usage === "object" ? (usage as Record<string, unknown>) : {}
  const inputTokens =
    typeof row.inputTokens === "number" ? row.inputTokens : undefined
  const outputTokens =
    typeof row.outputTokens === "number" ? row.outputTokens : undefined
  const totalTokens =
    typeof row.totalTokens === "number" ? row.totalTokens : undefined
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cost: pendingCost ?? costFromUsage(usage),
  }
}

function costFromUsage(usage: unknown): number | undefined {
  if (!usage || typeof usage !== "object") return undefined
  const raw = (usage as { raw?: unknown }).raw
  if (raw && typeof raw === "object" && "cost" in raw) {
    const cost = (raw as { cost?: unknown }).cost
    if (typeof cost === "number" && Number.isFinite(cost)) return cost
  }
  return undefined
}

function costFromUnknown(metadata: unknown): number | undefined {
  if (!metadata || typeof metadata !== "object") return undefined
  const openrouter = (metadata as { openrouter?: { usage?: { cost?: unknown } } })
    .openrouter
  const cost = openrouter?.usage?.cost
  return typeof cost === "number" && Number.isFinite(cost) ? cost : undefined
}

