import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import {
  COACH_STEP_CAP,
  coachProviderErrorMessage,
  DEFAULT_COACH_MAX_OUTPUT_TOKENS,
  DEFAULT_COACH_MODEL,
  DEFAULT_COACH_MODE,
  resolveCoachModel,
  type CoachRuntime,
  type CoachTitleInput,
  type CoachTurnInput,
} from "@workspace/domain"
import { generateText, stepCountIs, streamText, tool, type ToolSet } from "ai"

import { listApplyCardsForUser } from "../apply/queries.js"
import {
  commandRegistry,
  type AppDatabase,
  type CommandRegistry,
} from "../commands/index.js"
import { listPaperDocsForUser } from "../paper/queries.js"
import { getProfileForUser } from "../profile/queries.js"
import {
  assembleSystemPrompt,
  historyForRegenerate,
  snapshotFromLists,
  windowHistory,
} from "./prompt.js"
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
    async *streamTurn(input: CoachTurnInput) {
      const startedAt = Date.now()
      const abort = new AbortController()
      const turnModel = input.model ?? model
      const snapshot = {
        ...(await loadWorkspaceSnapshot(db, input.userId)),
        ...(input.focusDoc ? { focusDoc: input.focusDoc } : {}),
      }
      const tools = toAiSdkTools(
        assembleCoachTools({ db, userId: input.userId, registry })
      )
      const prepared = input.regenerate
        ? historyForRegenerate(input.history)
        : { history: input.history, priorCoach: undefined }
      const messages = windowHistory(prepared.history)

      try {
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
            }
          ),
          messages,
          tools,
          stopWhen: stepCountIs(COACH_STEP_CAP),
          maxOutputTokens,
          abortSignal: abort.signal,
        })

        yield* partsFromModelStream(
          normalizeFullStream(result.fullStream, input.mode),
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

async function loadWorkspaceSnapshot(db: AppDatabase, userId: string) {
  const [profile, paper, apply] = await Promise.all([
    getProfileForUser(db, userId).catch(() => null),
    listPaperDocsForUser(db, userId).catch(() => []),
    listApplyCardsForUser(db, userId).catch(() => []),
  ])
  return snapshotFromLists({ profile, paper, apply })
}

function toAiSdkTools(surface: CoachToolSurface): ToolSet {
  const tools: ToolSet = {}
  for (const [name, coachTool] of Object.entries(surface)) {
    tools[name] = tool({
      description: coachTool.description,
      inputSchema: coachTool.inputSchema as never,
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

