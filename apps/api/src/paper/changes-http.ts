import {
  ERROR_CODES,
  parsePaperId,
  parseUserId,
} from "@workspace/domain/kernel"
import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { z } from "zod"

import { CommandError } from "../platform/errors.js"
import type { SignedInVariables } from "../platform/signed-in.js"
import { changesSince } from "./engine-sync-log.js"

const PAPER_PULL_MS = 2_500
const cursorSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/)
  .transform(Number)
  .pipe(z.int().nonnegative())

export function createPaperChangesRoutes() {
  return new Hono<{ Variables: SignedInVariables }>().get(
    "/:id/changes",
    async (c) => {
      const id = z.uuid().safeParse(c.req.param("id"))
      const since = cursorSchema.safeParse(
        c.req.header("Last-Event-ID") ?? c.req.query("since") ?? "0"
      )
      if (!id.success || !since.success)
        throw new CommandError(
          ERROR_CODES.VALIDATION_ERROR,
          "Invalid Paper id or change cursor"
        )

      const docId = parsePaperId(id.data)
      const owner = parseUserId(c.var.userId)
      let batch = await changesSince(owner, docId, since.data)
      c.header("Cache-Control", "no-store")
      c.header("X-Accel-Buffering", "no")
      c.header("Content-Encoding", "identity")
      return streamSSE(c, async (stream) => {
        for (
          let reads = 0;
          reads < 12 && !stream.aborted && !c.req.raw.signal.aborted;
          reads += 1
        ) {
          if ("compacted" in batch) {
            await stream.writeSSE({
              event: "reset",
              data: JSON.stringify({ head: batch.compacted.head }),
            })
            return
          }
          for (const change of batch.changes) {
            if (stream.aborted || c.req.raw.signal.aborted) return
            await stream.writeSSE({
              event: "change",
              id: String(change.base + change.steps.length),
              data: JSON.stringify(change),
            })
          }
          if (reads === 11) return
          if (!batch.changes.length) await stream.write(": heartbeat\n\n")
          await stream.sleep(PAPER_PULL_MS)
          if (stream.aborted || c.req.raw.signal.aborted) return
          batch = await changesSince(owner, docId, batch.head)
        }
      })
    }
  )
}
