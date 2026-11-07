import type { DelegateActor } from "@workspace/domain"
import { and, count, desc, eq, gt, sql } from "drizzle-orm"
import { getDb, insideTransaction } from "../db/context.js"
import { agentToolCalls, user } from "../db/schema.js"
import { inputHash } from "../registry/receipt.js"

export async function delegateCallWindow(actor: DelegateActor) {
  if (!insideTransaction()) throw new Error("Agent calls need a transaction")
  await getDb()
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, actor.userId))
    .for("no key update")
  const [clock] = await getDb()
    .select({ now: sql<string>`clock_timestamp()::text` })
    .from(user)
    .where(eq(user.id, actor.userId))
  if (!clock) throw new Error("Database clock unavailable")
  const now = new Date(clock.now)
  const [calls] = await getDb()
    .select({
      owner: count(),
      connection:
        sql<number>`count(*) filter (where ${agentToolCalls.connectionId} = ${actor.connectionId})`.mapWith(
          Number
        ),
    })
    .from(agentToolCalls)
    .where(
      and(
        eq(agentToolCalls.userId, actor.userId),
        eq(agentToolCalls.charged, true),
        gt(agentToolCalls.createdAt, new Date(now.getTime() - 60_000))
      )
    )
  return {
    allowed: (calls?.owner ?? 0) < 120 && (calls?.connection ?? 0) < 60,
    now,
  }
}

export async function appendDelegateCall(options: {
  actor: DelegateActor
  tool: string
  input: unknown
  outcome: typeof agentToolCalls.$inferInsert.outcome
  proposalId?: string
  window: Awaited<ReturnType<typeof delegateCallWindow>>
}) {
  if (!insideTransaction()) throw new Error("Agent audit needs a transaction")
  await getDb()
    .insert(agentToolCalls)
    .values({
      userId: options.actor.userId,
      connectionId: options.actor.connectionId,
      createdAt: options.window.now,
      tool: options.tool,
      inputHash: inputHash(options.input),
      outcome: options.outcome,
      proposalId: options.proposalId,
      charged: options.window.allowed,
    })
}

export async function readDelegateActivity(
  userId: string,
  filter: { subjectKind?: string; subjectId?: string }
) {
  if (filter.subjectKind && filter.subjectKind !== "connection") return []
  const rows = await getDb()
    .select()
    .from(agentToolCalls)
    .where(
      and(
        eq(agentToolCalls.userId, userId),
        filter.subjectId
          ? sql`${agentToolCalls.connectionId}::text = ${filter.subjectId}`
          : undefined
      )
    )
    .orderBy(desc(agentToolCalls.createdAt))
    .limit(100)
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    actor: "delegate" as const,
    command: row.tool,
    subjectKind: "connection",
    subjectId: row.connectionId,
    summary: `Agent called ${row.tool}: ${row.outcome}.`,
    undoneAt: null,
    reversible: false,
  }))
}
