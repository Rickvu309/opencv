import { randomUUID } from "node:crypto"
import type { BlockId } from "@workspace/domain/paper-doc"
import { createEngine } from "@workspace/paper-engine"

import { createPaperLog } from "./paper-log.js"
import { postgresLogStore } from "./postgres-store.js"

export const serverEngine = createEngine({
  ids: () => randomUUID() as BlockId,
  now: () => Date.now(),
})

export const serverPaperLog = createPaperLog({
  store: postgresLogStore,
  engine: serverEngine,
})
