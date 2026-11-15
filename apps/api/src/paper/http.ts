import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  paperImportResponseSchema,
  nativeWriterSchema,
  type NativeWriter,
  paperPackageStageInputSchema,
  catalog,
  parseFileId,
  parseUserId,
  personActor,
  successEnvelope,
} from "@workspace/domain"
import { type Context, Hono } from "hono"

import { createId } from "../id.js"
import { PaperPackageRefusal } from "./package-errors.js"
import { stageWordPackage } from "./package-store.js"
import type { Auth } from "../auth.js"
import type { AppDatabase } from "../db/context.js"
import { jsonWithStatus } from "../http-json.js"
import { readJsonBody } from "../http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { CommandError } from "../registry/errors.js"
import { registry } from "../registry/registry.js"
import {
  classifyImport,
  extractLetterAttachment,
  importReadStop,
  parseImportLink,
} from "./import-parse.js"
import { importedWordPage } from "./import-word.js"
import { createPaperPackageRoutes } from "./package-http.js"
import {
  IMPORT_FILE_CAP,
  IMPORT_SIZE_MESSAGE,
  readOwnedPhoto,
  readSharedPhoto,
  saveFile,
} from "./store.js"

function readWriter(c: Context): NativeWriter | undefined {
  const raw = c.req.header("x-paper-writer")
  if (raw === undefined) return undefined
  try {
    return nativeWriterSchema.parse(JSON.parse(raw))
  } catch {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "This editor's document capabilities could not be read."
    )
  }
}

function person(userId: string) {
  return personActor(userId)
}

function stoppedRead(c: Context, error: unknown, place: "import" | "letter") {
  const stop = importReadStop(error, place)
  if (!stop) return null
  if (stop.retryAfterSeconds !== null)
    c.header("Retry-After", String(stop.retryAfterSeconds))
  c.header("Cache-Control", "no-store")
  return jsonWithStatus(c, errorEnvelope(stop.code, stop.message), stop.status)
}

function refuseCancelledImport(signal: AbortSignal) {
  if (signal.aborted)
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "The import was cancelled. No document was made."
    )
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

function concatBytes(chunks: Uint8Array[]) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

async function readImportUpload(
  c: Parameters<typeof jsonWithStatus>[0]
): Promise<{ over: true } | { over: false; file: File | null; link: string }> {
  const declared = Number(c.req.header("content-length"))
  if (Number.isFinite(declared) && declared > IMPORT_FILE_CAP) {
    return { over: true }
  }
  const reader = c.req.raw.body?.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > IMPORT_FILE_CAP) {
        await reader.cancel()
        return { over: true }
      }
      chunks.push(value)
    }
  }
  const type = c.req.header("content-type")
  let form: FormData
  try {
    form = await new Request("http://import.local/", {
      method: "POST",
      headers: type ? { "content-type": type } : undefined,
      body: concatBytes(chunks),
    }).formData()
  } catch {
    return { over: false, file: null, link: "" }
  }
  const file = form.get("file")
  const link = form.get("link")
  return {
    over: false,
    file: file instanceof File ? file : null,
    link: typeof link === "string" ? link : "",
  }
}

function refuseImportLink(
  c: Parameters<typeof jsonWithStatus>[0],
  value: string
) {
  const parsed = parseImportLink(value)
  if (!parsed || parsed.ok) {
    return jsonWithStatus(
      c,
      errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Choose a file to import."),
      httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
    )
  }
  return jsonWithStatus(
    c,
    errorEnvelope(parsed.code, parsed.message),
    httpStatusForError(parsed.code)
  )
}

export function createPaperRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = new Hono<{ Variables: SessionVariables }>()
  routes.route("/packages", createPaperPackageRoutes(auth, db))

  routes.use("/shared/*", async (c, next) => {
    c.header("cache-control", "no-store")
    await next()
  })

  routes.get("/shared/:token/photo", async (c) => {
    return photoBytes(await readSharedPhoto(c.req.param("token")), "no-store")
  })

  routes.get("/shared/:token", async (c) => {
    const data = await registry.read(
      "paper.shared",
      { token: c.req.param("token"), writer: readWriter(c) },
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
    const input: {
      query?: string
      kind?: "cv" | "letter"
      writer?: NativeWriter
    } = { writer: readWriter(c) }
    if (query) input.query = query
    if (kind === "cv" || kind === "letter") input.kind = kind
    const data = await registry.read("paper.list", input, person(c.var.userId))
    return c.json(successEnvelope(data))
  })

  routes.post("/letter-attachment", async (c) => {
    const uploaded = await readImportUpload(c)
    if (uploaded.over) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, IMPORT_SIZE_MESSAGE),
        413
      )
    }
    if (!uploaded.file || uploaded.link.trim()) {
      return jsonWithStatus(
        c,
        errorEnvelope(
          ERROR_CODES.VALIDATION_ERROR,
          "Choose a PDF, Word, or text file."
        ),
        400
      )
    }
    try {
      const result = await extractLetterAttachment(
        {
          name: uploaded.file.name,
          mediaType: uploaded.file.type,
          bytes: Buffer.from(await uploaded.file.arrayBuffer()),
        },
        { owner: c.var.userId, signal: c.req.raw.signal }
      )
      if (!result.ok)
        return jsonWithStatus(
          c,
          errorEnvelope(result.code, result.message),
          400
        )
      return c.json(successEnvelope(result.context))
    } catch (error) {
      const stopped = stoppedRead(c, error, "letter")
      if (stopped) return stopped
      return jsonWithStatus(
        c,
        errorEnvelope(
          ERROR_CODES.VALIDATION_ERROR,
          "Could not read that file. Try another file or paste the job text."
        ),
        400
      )
    }
  })

  routes.post("/import", async (c) => {
    const contentType = c.req.header("content-type") ?? ""
    if (contentType.includes("application/json")) {
      const parsed = await readJsonBody(c)
      if (!parsed.ok) return parsed.response
      const link =
        parsed.value &&
        typeof parsed.value === "object" &&
        "link" in parsed.value
          ? parsed.value.link
          : ""
      return refuseImportLink(c, typeof link === "string" ? link : "")
    }
    const uploaded = await readImportUpload(c)
    if (uploaded.over) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, IMPORT_SIZE_MESSAGE),
        413
      )
    }
    if (uploaded.link.trim()) return refuseImportLink(c, uploaded.link)
    const file = uploaded.file
    if (!(file instanceof File)) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Choose a file to import."),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }
    if (file.size > IMPORT_FILE_CAP) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, IMPORT_SIZE_MESSAGE),
        413
      )
    }
    let bytes: Buffer | undefined = Buffer.from(await file.arrayBuffer())
    try {
      const upload = {
        name: file.name,
        mediaType: file.type || "application/octet-stream",
        bytes,
      }
      const word =
        file.name.toLowerCase().endsWith(".docx") ||
        classifyImport(upload) === "docx"
          ? { name: file.name, bytes, notice: null }
          : await importedWordPage(upload, {
              owner: c.var.userId,
              signal: c.req.raw.signal,
            })
      bytes = undefined
      void bytes
      refuseCancelledImport(c.req.raw.signal)
      const input = paperPackageStageInputSchema.safeParse({
        requestId: c.req.header("idempotency-key") ?? createId(),
        name: word.name,
        kind: c.req.query("kind") ?? "cv",
      })
      if (!input.success)
        throw new CommandError(
          ERROR_CODES.VALIDATION_ERROR,
          "Choose a valid document name, kind, and upload key."
        )
      const staged = await stageWordPackage(
        c.var.userId,
        input.data,
        word.bytes
      )
      refuseCancelledImport(c.req.raw.signal)
      const imported = await registry.execute({
        name: catalog["paper.import"].name,
        input: { generation: "package", stageId: staged.stageId },
        actor: person(c.var.userId),
      })
      return c.json(
        paperImportResponseSchema.parse({
          ...successEnvelope(
            catalog["paper.import"].publicResult.parse(imported.output)
          ),
          ...(word.notice ? { notice: word.notice } : {}),
        })
      )
    } catch (error) {
      bytes = undefined
      void bytes
      const stopped = stoppedRead(c, error, "import")
      if (stopped) return stopped
      if (error instanceof PaperPackageRefusal)
        throw new CommandError(ERROR_CODES.VALIDATION_ERROR, error.message)
      throw error
    }
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
      { docId: c.req.param("id"), writer: readWriter(c) },
      person(c.var.userId)
    )
    return c.json(successEnvelope(data))
  })

  routes.get("/:id", async (c) => {
    const data = await registry.read(
      "paper.get",
      { docId: c.req.param("id"), writer: readWriter(c) },
      person(c.var.userId)
    )
    return c.json(successEnvelope(data))
  })

  return routes
}
