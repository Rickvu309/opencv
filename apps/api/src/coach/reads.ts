import {
  COACH_READ_TOOLS,
  ERROR_CODES,
  applyListCardsInputSchema,
  errorEnvelope,
  paperGetDocInputSchema,
  paperListDocsInputSchema,
  profileGetInputSchema,
  successEnvelope,
  type CommandEnvelope,
} from "@workspace/domain"

import { listApplyCardsForUser } from "../apply/queries.js"
import { CommandError, type AppDatabase } from "../commands/registry.js"
import { getPaperDocDetail, listPaperDocsForUser } from "../paper/queries.js"
import { getProfileForUser } from "../profile/queries.js"

type ParseFailure = {
  success: false
  error: { issues: { message: string }[] }
}

type ReadInputSchema<TInput> = {
  safeParse(input: unknown): { success: true; data: TInput } | ParseFailure
}

export type CoachReadContext = {
  db: AppDatabase
  userId: string
}

export type CoachReadToolDefinition<TInput> = {
  name: string
  description: string
  input: ReadInputSchema<TInput>
  run: (ctx: CoachReadContext, input: TInput) => Promise<unknown>
}

export type AnyCoachReadTool = CoachReadToolDefinition<unknown>

function defineReadTool<TInput>(
  definition: CoachReadToolDefinition<TInput>
): AnyCoachReadTool {
  return definition as AnyCoachReadTool
}

/**
 * Parallel read-tool table (ADR-0007). Each runner reuses a GET mapper so
 * the Coach cannot see more than the User's own read endpoints return.
 */
export const coachReadTools = [
  defineReadTool({
    name: COACH_READ_TOOLS.paperListDocs,
    description:
      "List the user's Paper documents, newest first. Same payload as GET /api/paper.",
    input: paperListDocsInputSchema,
    run: ({ db, userId }) => listPaperDocsForUser(db, userId),
  }),
  defineReadTool({
    name: COACH_READ_TOOLS.paperGetDoc,
    description:
      "Get one Paper document by id, including its content. Same payload as GET /api/paper/:id.",
    input: paperGetDocInputSchema,
    run: ({ db, userId }, { docId }) => getPaperDocDetail(db, userId, docId),
  }),
  defineReadTool({
    name: COACH_READ_TOOLS.applyListCards,
    description:
      "List the user's Apply cards. Fit is never included. Same payload as GET /api/apply.",
    input: applyListCardsInputSchema,
    run: ({ db, userId }) => listApplyCardsForUser(db, userId),
  }),
  defineReadTool({
    name: COACH_READ_TOOLS.profileGet,
    description:
      "Get the signed-in user's profile (name, email, image, Coach mode). Same payload as GET /api/profile.",
    input: profileGetInputSchema,
    run: ({ db, userId }) => getProfileForUser(db, userId),
  }),
]

export async function executeCoachRead(
  tool: AnyCoachReadTool,
  ctx: CoachReadContext,
  input: unknown
): Promise<CommandEnvelope> {
  const parsed = tool.input.safeParse(input)
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Invalid tool input"
    return errorEnvelope(ERROR_CODES.VALIDATION_ERROR, message)
  }

  try {
    const data = await tool.run(ctx, parsed.data)
    return successEnvelope(data)
  } catch (error) {
    if (error instanceof CommandError) {
      return errorEnvelope(error.code, error.message)
    }
    throw error
  }
}