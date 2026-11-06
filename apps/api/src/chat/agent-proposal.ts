import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { toJob } from "../job/index.js"
import { getDb } from "../db/context.js"
import { chats, chatMessages, pendingActions, jobs } from "../db/schema.js"
import { createId } from "../id.js"

export async function createAgentProposalChat(input: {
  chatId: string
  userId: string
  name: string
}) {
  await getDb()
    .insert(chats)
    .values({
      id: input.chatId,
      userId: input.userId,
      title: `Agent connection (${input.name}, unverified)`,
    })
}

export async function appendAgentProposalApproval(
  pendingActionId: string,
  userId: string
) {
  const [proposal] = await getDb()
    .select()
    .from(pendingActions)
    .where(
      and(
        eq(pendingActions.id, pendingActionId),
        eq(pendingActions.userId, userId)
      )
    )
  if (!proposal) throw new Error("Proposal not found")
  const stored = z
    .object({
      jobId: z.string(),
      patch: z.record(z.string(), z.unknown()).optional(),
      stage: z.string().optional(),
      priority: z.string().optional(),
      position: z.string().optional(),
    })
    .parse(proposal.input)
  const [job] = await getDb()
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, stored.jobId), eq(jobs.userId, userId)))
  if (!job) throw new Error("Job not found")
  const current = z.record(z.string(), z.unknown()).parse(toJob(job))
  const changes =
    stored.patch ??
    (proposal.command === "job.move"
      ? {
          stage: stored.stage,
          ...(stored.position === undefined
            ? {}
            : { position: stored.position }),
        }
      : { priority: stored.priority })
  const display = [
    `Job: ${JSON.stringify(job.title)} at ${JSON.stringify(job.company)}`,
    `Job ID: ${job.id}`,
    ...Object.entries(changes).map(
      ([field, value]) =>
        `${field}: ${JSON.stringify(current[field])} → ${JSON.stringify(value)}`
    ),
  ]
    .join("\n")
    .replace(/`/g, "\\u0060")
  const text = `Proposed changes.\n\n\`\`\`\n${display}\n\`\`\``
  await getDb()
    .insert(chatMessages)
    .values({
      id: createId(),
      chatId: proposal.chatId,
      role: "coach",
      text,
      status: "final",
      parts: [
        { type: "text", text },
        {
          type: "tool",
          name: proposal.command,
          summary: proposal.summary,
          ok: true,
          pendingActionId,
        },
      ],
    })
}
