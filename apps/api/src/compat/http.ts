import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  paperDocIdSchema,
  successEnvelope,
  threadIdSchema,
} from "@workspace/domain"
import { Hono } from "hono"

import { scanApplyPosting } from "../apply/scan.js"
import type { FetchJobPosting } from "../apply/fetch-posting.js"
import { fetchJobPosting } from "../apply/fetch-posting.js"
import type { Auth } from "../auth.js"
import type { CoachRuntime } from "@workspace/domain"
import type { AppDatabase } from "../db/context.js"
import { readJsonBody } from "../http-json.js"
import { jsonWithStatus } from "../http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { registry } from "../registry/registry.js"
import {
  compatThreadByFocus,
  compatThreadDetail,
  listCompatJobs,
  listCompatPaper,
  listCompatThreads,
} from "./commands.js"

function person(userId: string) {
  return { type: "person" as const, userId }
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

export function createCompatApplyRoutes(options: {
  auth?: Auth
  db?: AppDatabase
  coach?: CoachRuntime
  fetchJobPosting?: FetchJobPosting
}) {
  const routes = new Hono<{ Variables: SessionVariables }>()
  routes.use("*", requireSession(options.auth, options.db))
  const fetchPosting = options.fetchJobPosting ?? fetchJobPosting

  routes.post("/scan", async (c) => {
    const body = await readJsonBody(c)
    if (!body.ok) return body.response
    const result = await scanApplyPosting({
      input: body.value,
      coach: options.coach,
      fetchJobPosting: fetchPosting,
    })
    if (!result.ok) {
      return jsonWithStatus(
        c,
        errorEnvelope(result.code, result.message),
        httpStatusForError(result.code)
      )
    }
    return c.json(successEnvelope(result.data))
  })

  routes.get("/", async (c) => {
    const cards = await listCompatJobs(registry, person(c.var.userId))
    return c.json(successEnvelope(cards))
  })

  routes.get("/:id", async (c) => {
    const cards = await listCompatJobs(registry, person(c.var.userId))
    const card = cards.find((item) => item.id === c.req.param("id"))
    if (!card) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.NOT_FOUND, "Job not found"),
        httpStatusForError(ERROR_CODES.NOT_FOUND)
      )
    }
    return c.json(successEnvelope(card))
  })

  return routes
}
