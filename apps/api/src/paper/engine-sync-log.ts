import {
  ERROR_CODES,
  type PaperId,
  type UserId,
} from "@workspace/domain/kernel"
import type { Refusal } from "@workspace/domain/paper-doc"
import { createEngine, fixedClock, seededIds } from "@workspace/paper-engine"
import { and, eq } from "drizzle-orm"

import { getDb, transaction } from "../db/context.js"
import { paperDocs } from "../db/schema.js"
import { CommandError } from "../platform/errors.js"
import {
  createPaperLog,
  keepFirstPage,
  NEW_ENGINE,
  postgresLogStore,
} from "./log/index.js"

export const engineLog = keepFirstPage(
  createPaperLog({
    store: postgresLogStore,
    engine: createEngine({ ids: seededIds("server"), now: fixedClock() }),
  })
)

export async function lockOwnedPaper(
  owner: UserId,
  id: PaperId,
  mode: "share" | "update"
) {
  const [row] = await getDb()
    .select({
      engine: paperDocs.engine,
      head: paperDocs.headVersion,
      name: paperDocs.name,
      kind: paperDocs.kind,
    })
    .from(paperDocs)
    .where(and(eq(paperDocs.id, id), eq(paperDocs.userId, owner)))
    .limit(1)
    .for(mode)
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "Document not found")
  return row
}

export function admitted<T extends object>(
  result: T | { missing: true } | { refusal: Refusal }
): T {
  if ("missing" in result)
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Document not found")
  if ("refusal" in result) {
    const refusal = result.refusal
    const message =
      refusal.code === "schema" ? refusal.detail : "Paper change refused"
    throw new CommandError(refusal.code, message, refusal)
  }
  return result
}

export function requireEngineLog(engine: number) {
  if (engine !== NEW_ENGINE)
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Document not found")
}

export function changesSince(owner: UserId, docId: PaperId, since: number) {
  return transaction(async () => {
    const { engine } = await lockOwnedPaper(owner, docId, "share")
    requireEngineLog(engine)
    return admitted(await engineLog.since(docId, since))
  })
}

export function readEnginePaper(owner: UserId, docId: PaperId) {
  return transaction(async () => {
    const { engine, name, kind } = await lockOwnedPaper(owner, docId, "share")
    requireEngineLog(engine)
    return { docId, name, kind, ...admitted(await engineLog.head(docId)) }
  })
}
