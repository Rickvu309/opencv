import {
  APPLY_COMMANDS,
  PAPER_COMMANDS,
  PAPER_CONTENT_VERSION,
  THREAD_COMMANDS,
  decodePaperContent,
  type CoachFocusDoc,
  type CoachTurnInput,
  type PaperContentKind,
  type ThreadListItem,
} from "@workspace/domain"

import { commandRegistry } from "../../commands/index.js"
import type { AppDatabase } from "../../commands/registry.js"
import { paperDocs, user as userTable } from "../../db/schema.js"
import { createId } from "../../id.js"
import { getOwnedPaperDoc } from "../../paper/queries.js"
import { toCoachFocusDoc } from "../must-edit.js"
import type { GoldenScenario, SeedPaperDoc } from "./types.js"

export type SeededScenario = {
  userId: string
  threadId: string
  focusDoc?: CoachFocusDoc
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
    await seedPaperDoc(db, actor, doc)
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
    input: {
      title: `Eval · ${scenario.title}`,
      ...(scenario.focusDocId ? { focusDocId: scenario.focusDocId } : {}),
    },
    actor,
    db,
  })
  if (!thread.body.ok) {
    throw new Error(`seed threads.create failed: ${thread.body.error.message}`)
  }

  return {
    userId,
    threadId: (thread.body.data as ThreadListItem).id,
    ...(scenario.focusDocId
      ? { focusDoc: await focusDocFromSeed(db, userId, scenario.focusDocId) }
      : {}),
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

export function evalTurnInput(
  seeded: SeededScenario,
  scenario: GoldenScenario
): CoachTurnInput {
  return {
    userId: seeded.userId,
    threadId: seeded.threadId,
    history: [evalUserMessage(scenario.userMessage)],
    ...(seeded.focusDoc ? { focusDoc: seeded.focusDoc } : {}),
  }
}

async function seedPaperDoc(
  db: AppDatabase,
  actor: { type: "user"; userId: string },
  doc: SeedPaperDoc
) {
  const kind: PaperContentKind = doc.kind ?? "cv"
  if (doc.id) {
    const decoded = decodePaperContent(kind, PAPER_CONTENT_VERSION, doc.content)
    if (!decoded.ok) {
      throw new Error(`seed paper content invalid: ${decoded.message}`)
    }
    const now = new Date()
    await db.insert(paperDocs).values({
      id: doc.id,
      userId: actor.userId,
      name: doc.name,
      contentKind: kind,
      content: decoded.data as Record<string, unknown>,
      contentVersion: PAPER_CONTENT_VERSION,
      status: "draft",
      applyCardId: null,
      createdAt: now,
      updatedAt: now,
    })
    return
  }

  const created = await commandRegistry.execute({
    name: PAPER_COMMANDS.createDoc,
    input: { kind, name: doc.name, content: doc.content },
    actor,
    db,
  })
  if (!created.body.ok) {
    throw new Error(`seed paper.createDoc failed: ${created.body.error.message}`)
  }
}

async function focusDocFromSeed(
  db: AppDatabase,
  userId: string,
  focusDocId: string
): Promise<CoachFocusDoc> {
  const row = await getOwnedPaperDoc(db, userId, focusDocId)
  return toCoachFocusDoc(row)
}
