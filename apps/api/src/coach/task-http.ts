import { coachTaskEventsInputSchema } from "@workspace/domain/coach"
import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import type { SignedIn, SignedInVariables } from "../platform/signed-in.js"
import { CommandError } from "../platform/errors.js"
import { readTaskEvents } from "./task-reader.js"
import { idleUntilAbort, waitForAbort } from "./sse.js"

export function createCoachTaskRoutes(options: { signedIn: SignedIn }) {
  const routes = new Hono<{ Variables: SignedInVariables }>()
  routes.use("*", options.signedIn)
  routes.get("/:id/events", async (c) => {
    const raw = c.req.header("Last-Event-ID") ?? c.req.query("after")
    if (raw !== undefined && !/^(?:-1|0|[1-9][0-9]*)$/.test(raw))
      throw new CommandError("VALIDATION_ERROR", "Invalid task cursor")
    const parsed = coachTaskEventsInputSchema.safeParse({
      taskId: c.req.param("id"),
      after: raw === undefined ? -1 : Number(raw),
    })
    if (!parsed.success)
      throw new CommandError("VALIDATION_ERROR", "Invalid task cursor or id")
    const { taskId, after } = parsed.data
    const ownerId = c.var.userId
    let batch = await readTaskEvents(taskId, ownerId, after)
    if (batch.type === "reset") return c.json(batch, 409)
    c.header("X-Accel-Buffering", "no")
    c.header("Content-Encoding", "identity")
    c.header("Cache-Control", "no-cache")
    return streamSSE(c, async (stream) => {
      const abort = waitForAbort(stream, c.req.raw.signal)
      const idle = idleUntilAbort(abort)
      try {
        while (!stream.aborted && !c.req.raw.signal.aborted) {
          if (batch.type === "reset") {
            await stream.writeSSE({
              event: "reset",
              data: JSON.stringify(batch),
            })
            return
          }
          for (const event of batch.events) {
            if (stream.aborted || c.req.raw.signal.aborted) return
            await stream.writeSSE({
              id: String(event.seq),
              event: "task",
              data: JSON.stringify(event),
            })
          }
          if (batch.terminal) return
          const cursor = batch.cursor
          if (batch.events.length < 100) {
            await idle(250)
            if (stream.aborted || c.req.raw.signal.aborted) return
            await stream.write(": heartbeat\n\n")
          }
          batch = await readTaskEvents(taskId, ownerId, cursor)
        }
      } catch (error) {
        if (!stream.aborted && !c.req.raw.signal.aborted)
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({
              code:
                error instanceof CommandError ? error.code : "INTERNAL_ERROR",
              message: "Coach task stream closed",
            }),
          })
      } finally {
        abort.dispose()
      }
    })
  })
  return routes
}
