import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  successEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"
import { and, desc, eq } from "drizzle-orm"

import type { Auth } from "../auth.js"
import type { AppDatabase } from "../db/context.js"
import { getDb } from "../db/context.js"
import { activity } from "../db/schema.js"
import { jsonWithStatus } from "../http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { saveFile } from "../paper/index.js"
import { registry } from "../registry/registry.js"
import { exportAccount } from "./queries.js"
import { getProfileRow, toProfile } from "./store.js"
import { readUsage } from "./usage.js"

function sessionApp(auth?: Auth, db?: AppDatabase) {
  const routes = new Hono<{ Variables: SessionVariables }>()
  routes.use("*", requireSession(auth, db))
  return routes
}

export function createProfileRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = sessionApp(auth, db)
  routes.get("/", async (c) => {
    const row = await getProfileRow(c.var.userId)
    return c.json(successEnvelope(toProfile(row)))
  })
  return routes
}

export function createAccountRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = sessionApp(auth, db)

  routes.post("/photo", async (c) => {
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Choose an image to upload."),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }
    const saved = await saveFile({
      userId: c.var.userId,
      name: file.name,
      mediaType: file.type || "application/octet-stream",
      bytes: Buffer.from(await file.arrayBuffer()),
      purpose: "avatar",
    })
    const result = await registry.execute({
      name: "profile.setPhoto",
      input: { fileId: saved.id },
      actor: { type: "person", userId: c.var.userId },
    })
    return c.json(successEnvelope(result.output))
  })

  routes.get("/export", async (c) => {
    const data = await exportAccount(c.var.userId)
    const body = JSON.stringify(data)
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": 'attachment; filename="opencv-export.json"',
      },
    })
  })

  return routes
}

export function createSearchRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = sessionApp(auth, db)
  routes.get("/", async (c) => {
    const query = (c.req.query("q") ?? c.req.query("query") ?? "").trim()
    if (!query) return c.json(successEnvelope([]))
    const data = await registry.read(
      "workspace.search",
      { query },
      { type: "person", userId: c.var.userId }
    )
    return c.json(successEnvelope(data))
  })
  return routes
}

export function createActivityRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = sessionApp(auth, db)
  routes.get("/", async (c) => {
    const rows = await getDb()
      .select()
      .from(activity)
      .where(and(eq(activity.userId, c.var.userId)))
      .orderBy(desc(activity.createdAt))
      .limit(100)
    return c.json(
      successEnvelope(
        rows.map((row) => ({
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          actor: row.actor,
          command: row.command,
          subjectKind: row.subjectKind,
          subjectId: row.subjectId,
          summary: row.summary,
          undoneAt: row.undoneAt?.toISOString() ?? null,
        }))
      )
    )
  })
  return routes
}

export function createUsageRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = sessionApp(auth, db)
  routes.get("/usage", async (c) => {
    const data = await readUsage(c.var.userId)
    return c.json(successEnvelope(data))
  })
  return routes
}
