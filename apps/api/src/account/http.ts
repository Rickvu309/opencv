import {
  catalog,
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
import { implementation as setPhoto } from "./operations/profile/set-photo/server.js"
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
      catalog["profile.get"].name,
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
      name: setPhoto.operation.name,
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
