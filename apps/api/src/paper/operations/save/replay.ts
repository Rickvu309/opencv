import { isDeepStrictEqual } from "node:util"
import {
  blockIdSchema,
  type BlockId,
  type Change,
  type Document,
} from "@workspace/domain/paper-doc"
import { createEngine, fixedClock, seededIds } from "@workspace/paper-engine"

import { CommandError } from "../../../platform/errors.js"

function allocatedIds(doc: Document, change: Change) {
  const known = new Set(doc.content.map((block) => block.attrs.id))
  const ids: BlockId[] = []
  for (const step of change.steps) {
    const slice = step.slice
    if (!slice || typeof slice !== "object" || Array.isArray(slice)) continue
    if (!Array.isArray(slice.content)) continue
    for (const node of slice.content) {
      if (!node || typeof node !== "object" || Array.isArray(node)) continue
      const attrs = node.attrs
      if (!attrs || typeof attrs !== "object" || Array.isArray(attrs)) continue
      const id = blockIdSchema.safeParse(attrs.id)
      if (!id.success || known.has(id.data)) continue
      known.add(id.data)
      ids.push(id.data)
    }
  }
  return ids
}

export function verifyCommands(doc: Document, change: Change) {
  const ids = allocatedIds(doc, change).values()
  const fallback = seededIds("replay")
  const engine = createEngine({
    ids: () => ids.next().value ?? fallback(),
    now: fixedClock(),
  })
  const state = engine.load(doc, change.base, change.origin.client)
  const replay = engine.run(state, change.commands, change.origin)
  if (
    "refusal" in replay ||
    !isDeepStrictEqual(replay.change.steps, change.steps)
  )
    throw new CommandError("schema", "Paper steps do not match their commands")
  return engine.read(replay.state).doc
}
