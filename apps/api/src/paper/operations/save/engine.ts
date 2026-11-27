import { isDeepStrictEqual } from "node:util"
import { ERROR_CODES, parsePaperId, type Actor } from "@workspace/domain/kernel"
import type { saveChangesInputSchema } from "@workspace/domain/operations/paper/save"
import type { Change } from "@workspace/domain/paper-doc"
import type { output } from "zod"

import { CommandError } from "../../../platform/errors.js"
import {
  admitted,
  engineLog,
  lockOwnedPaper,
  requireEngineLog,
} from "../../engine-sync-log.js"
import { MAX_CHANGE_BYTES, MAX_STEPS_PER_CHANGE } from "../../log/index.js"
import { verifyCommands } from "./replay.js"

function sameEdit(saved: Change, sent: Change) {
  return isDeepStrictEqual(saved, { ...sent, inverse: saved.inverse })
}

function checkBatch(
  input: output<typeof saveChangesInputSchema>,
  owner: string
) {
  let base = input.base
  const edits = new Set<string>()
  for (const change of input.changes) {
    const { origin, steps } = change
    if (
      origin.kind !== "person" ||
      origin.actor !== owner ||
      origin.client !== input.client ||
      origin.proposal !== undefined
    )
      throw new CommandError(
        "schema",
        "Paper change must come from this tab's owner"
      )
    if (change.base !== base || steps.length === 0 || edits.has(change.edit))
      throw new CommandError(
        "schema",
        "Paper changes must be in order and have unique edits"
      )
    if (
      steps.length > MAX_STEPS_PER_CHANGE ||
      Buffer.byteLength(JSON.stringify(change)) > MAX_CHANGE_BYTES
    )
      throw new CommandError("too-large", "Paper change exceeds the save limit")
    base += steps.length
    edits.add(change.edit)
  }
}

export async function saveEngineChanges(
  input: output<typeof saveChangesInputSchema>,
  actor: Actor
) {
  if (actor.type !== "person")
    throw new CommandError(
      ERROR_CODES.FORBIDDEN,
      "Only the signed-in owner can save Paper"
    )

  const docId = parsePaperId(input.docId)
  const { engine, head } = await lockOwnedPaper(actor.userId, docId, "update")
  requireEngineLog(engine)
  checkBatch(input, actor.userId)

  if (input.base !== head) {
    const since = admitted(await engineLog.since(docId, input.base))
    if ("compacted" in since)
      return { stale: true, head, compacted: since.compacted } as const

    const saved = new Map(since.changes.map((change) => [change.edit, change]))
    let duplicates = 0
    for (const change of input.changes) {
      const prior = saved.get(change.edit)
      if (!prior) continue
      if (!sameEdit(prior, change))
        throw new CommandError(
          "schema",
          "Paper edit was already saved with other steps"
        )
      duplicates += 1
    }
    return duplicates === input.changes.length
      ? ({ ok: true, head } as const)
      : ({ stale: true, head, since: since.changes } as const)
  }

  let doc = admitted(await engineLog.head(docId)).doc
  for (const change of input.changes) doc = verifyCommands(doc, change)

  let version = head
  for (const change of input.changes) {
    const stored = admitted(await engineLog.append(docId, change))
    version = stored.head
  }
  return { ok: true, head: version } as const
}
