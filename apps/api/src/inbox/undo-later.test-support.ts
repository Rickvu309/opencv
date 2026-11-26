import { catalog } from "@workspace/domain/kernel"
import { eq } from "drizzle-orm"

import { inboxThreads } from "../db/schema.js"
import { idOf } from "../registry/coverage-helpers.test-support.js"
import type { ExecuteResult } from "../registry/registry.js"
import type {
  LaterCases,
  LaterWorld,
} from "../registry/undo-later.test-support.js"

async function threadStatus(world: LaterWorld, a: ExecuteResult) {
  const [row] = await world.db
    .select({ status: inboxThreads.status })
    .from(inboxThreads)
    .where(eq(inboxThreads.id, idOf(a.output)))
  return row?.status
}

export const inboxUndoLater: LaterCases = {
  [catalog["inbox.markDone"].name]: {
    act: async (a, { run }) => {
      await run("inbox.snooze", {
        threadId: idOf(a.output),
        until: "2026-10-30T00:00:00.000Z",
      })
    },
    survives: async (a, world) => (await threadStatus(world, a)) === "snoozed",
  },
  [catalog["inbox.snooze"].name]: {
    act: async (a, { run }) => {
      await run("inbox.markDone", { threadId: idOf(a.output) })
    },
    survives: async (a, world) => (await threadStatus(world, a)) === "done",
  },
}
