// Temporary compat routes. #377 deletes threads and #378 deletes paper.
import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  paperDocIdSchema,
  personActor,
  successEnvelope,
  threadIdSchema,
} from "@workspace/domain"
import { Hono } from "hono"

import type { Auth } from "../auth.js"
import type { AppDatabase } from "../db/context.js"
import { jsonWithStatus } from "../http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { registry } from "../registry/registry.js"
import {
  compatThreadByFocus,
  compatThreadDetail,
  listCompatPaper,
  listCompatThreads,
} from "./commands.js"

function person(userId: string) {
  return personActor(userId)
}

export function createCompatThreadRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = new Hono<{ Variables: SessionVariables }>()
  routes.use("*", requireSession(auth, db))

  routes.get("/", async (c) => {
    const actor = person(c.var.userId)
    const focusDocId = c.req.query("focusDocId")
    if (focusDocId !== undefined) {
      const parsed = paperDocIdSchema.safeParse(focusDocId)
      if (!parsed.success) {
        return jsonWithStatus(
          c,
          errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid focusDocId"),
          httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
        )
      }
      const thread = await compatThreadByFocus(registry, actor, parsed.data)
      return c.json(successEnvelope(thread))
    }
    return c.json(successEnvelope(await listCompatThreads(registry, actor)))
  })

  routes.get("/:id", async (c) => {
    const parsed = threadIdSchema.safeParse(c.req.param("id"))
    if (!parsed.success) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid thread id"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }
    const thread = await compatThreadDetail(
      registry,
      person(c.var.userId),
      parsed.data
    )
    return c.json(successEnvelope(thread))
  })

  return routes
}

export function createCompatPaperRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = new Hono<{ Variables: SessionVariables }>()
  routes.use("*", requireSession(auth, db))
  routes.get("/", async (c) => {
    const kind = c.req.query("kind")
    const query = c.req.query("query") ?? c.req.query("q")
    if (kind === "cv" || kind === "letter" || query) {
      const input: { query?: string; kind?: "cv" | "letter" } = {}
      if (query) input.query = query
      if (kind === "cv" || kind === "letter") input.kind = kind
      const data = await registry.read(
        "paper.list",
        input,
        person(c.var.userId)
      )
      return c.json(successEnvelope(data))
    }
    const docs = await listCompatPaper(registry, person(c.var.userId))
    return c.json(successEnvelope(docs))
  })
  routes.get("/:id", async (c) => {
    const docs = await listCompatPaper(registry, person(c.var.userId))
    const doc = docs.find((item) => item.id === c.req.param("id"))
    if (!doc) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.NOT_FOUND, "Document not found"),
        httpStatusForError(ERROR_CODES.NOT_FOUND)
      )
    }
    return c.json(successEnvelope(doc))
  })
  return routes
}
