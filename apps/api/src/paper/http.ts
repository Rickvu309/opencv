import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  parseFileId,
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
import { CommandError } from "../registry/errors.js"
import { registry } from "../registry/registry.js"
import { readOwnedPhoto, readSharedPhoto, saveFile } from "./store.js"

function person(userId: string) {
  return personActor(userId)
}

const PHOTO_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
}

function photoBytes(
  photo: { mediaType: string; bytes: Uint8Array },
  cacheControl: string
) {
  const ext = PHOTO_EXTENSION[photo.mediaType] ?? "bin"
  return new Response(new Uint8Array(photo.bytes), {
    status: 200,
    headers: {
      "content-type": photo.mediaType,
      "x-content-type-options": "nosniff",
      "content-disposition": `inline; filename="photo.${ext}"`,
      "cache-control": cacheControl,
    },
  })
}

function fileIdOrMissing(value: string) {
  try {
    return parseFileId(value)
  } catch {
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Photo not found")
  }
}

export function createPaperRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = new Hono<{ Variables: SessionVariables }>()

  routes.get("/shared/:token/photo", async (c) => {
    return photoBytes(
      await readSharedPhoto(c.req.param("token")),
      "public, max-age=60"
    )
  })

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

  routes.post("/files", async (c) => {
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
    return c.json(successEnvelope({ id: saved.id }))
  })

  routes.get("/files/:id/bytes", async (c) => {
    const photo = await readOwnedPhoto(
      parseUserId(c.var.userId),
      fileIdOrMissing(c.req.param("id"))
    )
    return photoBytes(photo, "private, no-store")
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
