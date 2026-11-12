import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  parseUserId,
  personActor,
  successEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"

import type { Auth } from "../auth.js"
import type { AppDatabase } from "../db/context.js"
import { jsonWithStatus } from "../http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { saveFile } from "../paper/index.js"
import { registry } from "../registry/registry.js"
import { createExportGate, gatedExport } from "./export-gate.js"
import { exportAccountArchive } from "./queries.js"

function sessionApp(auth?: Auth, db?: AppDatabase) {
  const routes = new Hono<{ Variables: SessionVariables }>()
  routes.use("*", requireSession(auth, db))
  return routes
}

export function createProfileRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = sessionApp(auth, db)
  routes.get("/", async (c) => {
    const data = await registry.read(
      "profile.get",
      {},
      personActor(c.var.userId)
    )
    return c.json(successEnvelope(data))
  })
  return routes
}

export function createIntegrationsRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = sessionApp(auth, db)
  routes.get("/", async (c) => {
    const data = await registry.read(
      "integrations.list",
      {},
      personActor(c.var.userId)
    )
    return c.json(successEnvelope(data))
  })
  return routes
}

export function createBillingRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = sessionApp(auth, db)
  routes.get("/", async (c) => {
    const data = await registry.read(
      "billing.get",
      {},
      personActor(c.var.userId)
    )
    return c.json(successEnvelope(data))
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
        errorEnvelope(
          ERROR_CODES.VALIDATION_ERROR,
          "Choose an image to upload."
        ),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }
    const saved = await saveFile({
      userId: parseUserId(c.var.userId),
      name: file.name,
      mediaType: file.type || "application/octet-stream",
      bytes: Buffer.from(await file.arrayBuffer()),
      purpose: "avatar",
    })
    const result = await registry.execute({
      name: "profile.setPhoto",
      input: { fileId: saved.id },
      actor: personActor(c.var.userId),
    })
    return c.json(successEnvelope(result.output))
  })

  const exportGate = createExportGate()
  routes.get("/export", (c) =>
    gatedExport(exportGate, c.var.userId, () =>
      exportAccountArchive(c.var.userId)
    )
  )

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
      personActor(c.var.userId)
    )
    return c.json(successEnvelope(data))
  })
  return routes
}

export function createActivityRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = sessionApp(auth, db)
  routes.get("/", async (c) => {
    const subjectKind = c.req.query("subjectKind")
    const subjectId = c.req.query("subjectId")
    const data = await registry.read(
      "activity.list",
      {
        ...(subjectKind ? { subjectKind } : {}),
        ...(subjectId ? { subjectId } : {}),
      },
      personActor(c.var.userId)
    )
    return c.json(successEnvelope(data))
  })
  return routes
}

export function createUsageRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = sessionApp(auth, db)
  routes.get("/usage", async (c) => {
    const data = await registry.read(
      "coach.usage",
      {},
      personActor(c.var.userId)
    )
    return c.json(successEnvelope(data))
  })
  return routes
}
