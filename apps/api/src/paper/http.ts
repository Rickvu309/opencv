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
import { readJsonBody } from "../http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { registry } from "../registry/registry.js"
import { renderPdf, saveFile } from "./store.js"

function person(userId: string) {
  return personActor(userId)
}

export function createPaperRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = new Hono<{ Variables: SessionVariables }>()

  routes.get("/shared/:token", async (c) => {
    const data = await registry.read(
      "paper.shared",
      { token: c.req.param("token") },
      personActor("public")
    )
    return c.json(successEnvelope(data))
  })

  routes.use("*", async (c, next) => {
    if (c.req.path.includes("/shared/")) return next()
    return requireSession(auth, db)(c, next)
  })

  routes.get("/", async (c) => {
    const kind = c.req.query("kind")
    const query = c.req.query("query") ?? c.req.query("q")
    if (kind && kind !== "cv" && kind !== "letter") {
      return jsonWithStatus(
        c,
        errorEnvelope(
          ERROR_CODES.VALIDATION_ERROR,
          "Use cv or letter for kind."
        ),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }
    const input: { query?: string; kind?: "cv" | "letter" } = {}
    if (query) input.query = query
    if (kind === "cv" || kind === "letter") input.kind = kind
    const data = await registry.read("paper.list", input, person(c.var.userId))
    return c.json(successEnvelope(data))
  })

  routes.post("/import", async (c) => {
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Choose a file to import."),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }
    const saved = await saveFile({
      userId: parseUserId(c.var.userId),
      name: file.name,
      mediaType: file.type || "application/octet-stream",
      bytes: Buffer.from(await file.arrayBuffer()),
      purpose: "import",
    })
    const imported = await registry.execute({
      name: "paper.import",
      input: { fileId: saved.id },
      actor: person(c.var.userId),
    })
    return c.json(successEnvelope(imported.output))
  })

  routes.get("/files", async (c) => {
    const data = await registry.read("paper.files", {}, person(c.var.userId))
    return c.json(successEnvelope(data))
  })

  routes.get("/:id/pdf", async (c) => {
    const data = await registry.read(
      "paper.pdf",
      { docId: c.req.param("id") },
      person(c.var.userId)
    )
    const named = data as { name: string }
    const bytes = renderPdf(named.name)
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: { "content-type": "application/pdf" },
    })
  })

  routes.get("/:id/pages", async (c) => {
    const data = await registry.read(
      "paper.pageCount",
      { docId: c.req.param("id") },
      person(c.var.userId)
    )
    return c.json(successEnvelope(data))
  })

  routes.get("/:id", async (c) => {
    const data = await registry.read(
      "paper.get",
      { docId: c.req.param("id") },
      person(c.var.userId)
    )
    return c.json(successEnvelope(data))
  })

  return routes
}

export async function readOptionalJson(c: Parameters<typeof readJsonBody>[0]) {
  return readJsonBody(c)
}
