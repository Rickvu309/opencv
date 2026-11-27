import {
  ERROR_CODES,
  type Actor,
  type PaperId,
  type UserId,
} from "@workspace/domain/kernel"
import type {
  AgentCommand,
  Change,
  Document,
  Origin,
  Refusal,
} from "@workspace/domain/paper-doc"

import { CommandError } from "../platform/errors.js"
import { serverEngine, serverPaperLog } from "./log/index.js"
import {
  changedBlocks,
  landAt,
  runAgentCommands,
} from "./operations/edit/agent-commands.js"
import { ownedPaperOrNull } from "./store.js"

export const COACH_EDIT_MOVED = "The Paper changed where Coach wanted to edit"
export const PAPER_CHANGED_SINCE = "The Paper changed there since"
const OUTLINE_LIMIT = 20_000

export async function enginePaperOrNull(userId: UserId, docId: PaperId) {
  const row = await ownedPaperOrNull(userId, docId)
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "Document not found")
  return row.engine === 2 ? row : null
}

async function requireEnginePaper(userId: UserId, docId: PaperId) {
  const row = await enginePaperOrNull(userId, docId)
  if (!row)
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "This Paper takes edits with blockId, from, to and before; read paper.outline again"
    )
  return row
}

function refused(refusal: Refusal, moved: string): never {
  if (refusal.code === "unmappable" || refusal.code === "stale")
    throw new CommandError(ERROR_CODES.CONFLICT, moved)
  if (refusal.code === "expect-mismatch")
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      `The Paper does not have the expected text there (expect-mismatch); it has ${JSON.stringify(refusal.found)}`
    )
  if (refusal.code === "no-such-position")
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      `There is no such place on the Paper (no-such-position at block ${refusal.at.block})`
    )
  throw new CommandError(
    ERROR_CODES.VALIDATION_ERROR,
    refusal.code === "schema"
      ? `This edit cannot be made (schema): ${refusal.detail}`
      : `This edit is too large (${refusal.limit})`
  )
}

function settled<T extends object>(
  result: T | { refusal: Refusal } | { missing: true },
  moved: string
): T {
  if ("missing" in result)
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Document not found")
  if ("refusal" in result) refused(result.refusal, moved)
  return result as T
}

function originOf(actor: Actor): Origin {
  if (actor.type === "delegate")
    return { kind: "agent", actor: actor.userId, client: "agent" }
  if (actor.type === "coach")
    return { kind: "coach", actor: actor.userId, client: "coach" }
  return { kind: "person", actor: actor.userId, client: "api" }
}

type EngineEditInput = {
  docId: PaperId
  basedOn: number
  commands: AgentCommand[]
}

export async function dryRunEngineEdit(input: EngineEditInput, actor: Actor) {
  await requireEnginePaper(actor.userId, input.docId)
  const at = settled(
    await serverPaperLog.at(input.docId, input.basedOn),
    COACH_EDIT_MOVED
  )
  settled(
    runAgentCommands(
      serverEngine,
      at.doc,
      input.basedOn,
      originOf(actor),
      input.commands
    ),
    COACH_EDIT_MOVED
  )
  return input.basedOn
}

export async function applyEngineEdit(input: EngineEditInput, actor: Actor) {
  const row = await requireEnginePaper(actor.userId, input.docId)
  let landed: { change: Change; before: Document; after: Document } | null =
    null
  const appended = settled(
    await serverPaperLog.appendAt(input.docId, input.basedOn, (at) => {
      const change = landAt(
        serverEngine,
        at,
        input.basedOn,
        originOf(actor),
        input.commands
      )
      if ("refusal" in change) return change
      const applied = serverEngine.apply(at.head, change.steps)
      if ("refusal" in applied) return applied
      landed = { change, before: at.head, after: applied.doc }
      return change
    }),
    COACH_EDIT_MOVED
  )
  const done = landed as {
    change: Change
    before: Document
    after: Document
  } | null
  if (!done) throw new CommandError(ERROR_CODES.CONFLICT, COACH_EDIT_MOVED)
  return {
    format: "rich" as const,
    docId: input.docId,
    name: row.name,
    kind: row.kind,
    changes: changedBlocks(done.before, done.after),
    revision: appended.head,
    editId: done.change.edit as string,
  }
}

export async function revertEngineEdit(
  userId: UserId,
  input: { docId: PaperId; edit: string }
) {
  await requireEnginePaper(userId, input.docId)
  const appended = settled(
    await serverPaperLog.revert(input.docId, input.edit, {
      edit: `revert-${input.edit}`,
      origin: { kind: "person", actor: userId, client: "undo" },
    }),
    PAPER_CHANGED_SINCE
  )
  return { docId: input.docId, revision: appended.head }
}

function blockOutline(block: Document["content"][number], selected: boolean) {
  if (block.type !== "text_block")
    return { id: block.attrs.id, type: block.type, selected }
  let text = ""
  const marks: { type: string; from: number; to: number; href?: string }[] = []
  for (const run of block.content ?? []) {
    const piece = run.type === "text" ? run.text : "\n"
    for (const mark of run.type === "text" ? (run.marks ?? []) : [])
      marks.push({
        type: mark.type,
        from: text.length,
        to: text.length + piece.length,
        ...(mark.type === "link" ? { href: mark.attrs.href } : {}),
      })
    text += piece
  }
  return {
    id: block.attrs.id,
    kind: block.attrs.kind,
    list: block.attrs.list,
    level: block.attrs.level,
    text,
    marks,
    selected,
  }
}

export async function readEngineOutline(
  docId: PaperId,
  blockIds: readonly string[] | undefined
) {
  const head = settled(await serverPaperLog.head(docId), COACH_EDIT_MOVED)
  const chosen = new Set(blockIds ?? [])
  const blocks: unknown[] = []
  let size = 2
  let truncated = false
  for (const block of head.doc.content) {
    const entry = blockOutline(block, chosen.has(block.attrs.id))
    const length = JSON.stringify(entry).length + 1
    if (size + length > OUTLINE_LIMIT) {
      truncated = true
      break
    }
    size += length
    blocks.push(entry)
  }
  return {
    revision: head.version,
    outline: JSON.stringify(blocks),
    truncated,
    engine: 2 as const,
  }
}
