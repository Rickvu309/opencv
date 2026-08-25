import {
  APPLY_COMMANDS,
  PAPER_COMMANDS,
  THREAD_COMMANDS,
  type ThreadListItem,
} from "@workspace/domain"

import { commandRegistry } from "../../commands/index.js"
import type { AppDatabase } from "../../commands/registry.js"
import { user as userTable } from "../../db/schema.js"
import { createId } from "../../id.js"
import type { GoldenScenario } from "./types.js"

export type SeededScenario = {
  userId: string
  threadId: string
}

export async function seedGoldenScenario(
  db: AppDatabase,
  scenario: GoldenScenario
): Promise<SeededScenario> {
  const userId = `eval-${scenario.id}`
  const now = new Date()

  await db.insert(userTable).values({
    id: userId,
    name: scenario.seed.profileName,
    email: `${scenario.id}@eval.openpath.app`,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  })

  const actor = { type: "user" as const, userId }

  for (const doc of scenario.seed.paper) {
    const created = await commandRegistry.execute({
      name: PAPER_COMMANDS.createDoc,
      input: { kind: "cv", name: doc.name, content: doc.content },
      actor,
      db,
    })
    if (!created.body.ok) {
      throw new Error(`seed paper.createDoc failed: ${created.body.error.message}`)
    }
  }

  for (const card of scenario.seed.apply) {
    const created = await commandRegistry.execute({
      name: APPLY_COMMANDS.createCard,
      input: {
        title: card.title,
        company: card.company,
        note: card.note ?? "",
        stage: card.stage,
        starred: card.starred,
        jobUrl: card.jobUrl ?? null,
      },
      actor,
      db,
    })
    if (!created.body.ok) {
      throw new Error(`seed apply.createCard failed: ${created.body.error.message}`)
    }
  }

  const thread = await commandRegistry.execute({
    name: THREAD_COMMANDS.create,
    input: { title: `Eval · ${scenario.title}` },
    actor,
    db,
  })
  if (!thread.body.ok) {
    throw new Error(`seed threads.create failed: ${thread.body.error.message}`)
  }

  return {
    userId,
    threadId: (thread.body.data as ThreadListItem).id,
  }
}

export function evalUserMessage(text: string) {
  return {
    id: createId(),
    role: "user" as const,
    text,
    createdAt: new Date().toISOString(),
  }
}
