import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  LIMITS,
  parseUserId,
  personActor,
  successEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"

import { jsonWithStatus } from "../platform/http-json.js"
import type { SignedIn, SignedInVariables } from "../platform/signed-in.js"
import { saveFile } from "../paper/index.js"
import { keyFor, limited, memoryLedger, systemClock } from "../limits/index.js"
import { registry } from "../registry/registry.js"
import { exportDownload } from "./export-download.js"
import { exportAccountArchive } from "./queries.js"

function sessionApp(signedIn: SignedIn) {
  const routes = new Hono<{ Variables: SignedInVariables }>()
  routes.use("*", signedIn)
  return routes
}

export function createProfileRoutes(signedIn: SignedIn) {
  const routes = sessionApp(signedIn)
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

export function createIntegrationsRoutes(signedIn: SignedIn) {
  const routes = sessionApp(signedIn)
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

export function createBillingRoutes(signedIn: SignedIn) {
  const routes = sessionApp(signedIn)
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

export function createAccountRoutes(signedIn: SignedIn) {
  const routes = sessionApp(signedIn)

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

  const clock = systemClock()
  const exportLedger = memoryLedger(LIMITS["export.running"], clock)
  routes.get(
    "/export",
    limited(
      "export.running",
      (c) => keyFor("account", c.var.userId),
      exportLedger,
      clock
    ),
    async (c) => {
      const archive = await exportAccountArchive(c.var.userId)
      return exportDownload(archive, c.req.raw.signal)
    }
  )

  return routes
}

export function createSearchRoutes(signedIn: SignedIn) {
  const routes = sessionApp(signedIn)
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

export function createActivityRoutes(signedIn: SignedIn) {
  const routes = sessionApp(signedIn)
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

export function createUsageRoutes(signedIn: SignedIn) {
  const routes = sessionApp(signedIn)
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
