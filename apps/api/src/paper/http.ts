import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  catalog,
  parseFileId,
  parseUserId,
  personActor,
  successEnvelope,
} from "@workspace/domain/kernel"
import { paperImportResponseSchema } from "@workspace/domain/paper-doc"
import { createHash } from "node:crypto"
import { type Context, Hono } from "hono"
import { z } from "zod"

import { createId } from "../platform/id.js"
import { jsonWithStatus } from "../platform/http-json.js"
import { readJsonBody } from "../platform/http-json.js"
import type { SignedIn, SignedInVariables } from "../platform/signed-in.js"
import { CommandError } from "../platform/errors.js"
import { registry } from "../registry/registry.js"
import {
  extractLetterAttachment,
  importReadStop,
  parseImportLink,
} from "./import/import-parse.js"
import { importedPaper } from "./import/import-word.js"
import { createNativeWordRoutes } from "./native-word-http.js"
import {
  IMPORT_FILE_CAP,
  IMPORT_SIZE_MESSAGE,
  readOwnedPhoto,
  saveFile,
} from "./store.js"

const paperImportKindSchema = z.enum(["cv", "letter"])

function importFileId(userId: string, requestKey: string) {
  const hex = createHash("sha256")
    .update(`paper-import:${userId}:${requestKey}`)
    .digest("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}-${hex.slice(20, 32)}`
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

export function createPaperRoutes(signedIn: SignedIn) {
  const routes = new Hono<{ Variables: SignedInVariables }>()

  routes.use("*", signedIn)

  routes.route("/", createNativeWordRoutes())

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
    const kind = paperImportKindSchema.safeParse(c.req.query("kind") ?? "cv")
    if (!kind.success)
      throw new CommandError(
        ERROR_CODES.VALIDATION_ERROR,
        "Choose a valid document kind."
      )
    const requestKey = c.req.header("idempotency-key") ?? createId()
    let bytes: Buffer | undefined = Buffer.from(await file.arrayBuffer())
    try {
      const upload = {
        name: file.name,
        mediaType: file.type || "application/octet-stream",
        bytes,
        kind: kind.data,
      }
      const imported = await importedPaper(upload, {
        owner: c.var.userId,
        signal: c.req.raw.signal,
      })
      refuseCancelledImport(c.req.raw.signal)
      const saved = await saveFile({
        userId: parseUserId(c.var.userId),
        name: file.name,
        mediaType: upload.mediaType,
        bytes,
        purpose: "import",
        id: importFileId(c.var.userId, requestKey),
      })
      bytes = undefined
      void bytes
      refuseCancelledImport(c.req.raw.signal)
      const created = await registry.execute({
        name: catalog["paper.import"].name,
        input: {
          fileId: saved.id,
          kind: kind.data,
          name: imported.name,
          paper: imported.paper,
        },
        actor: person(c.var.userId),
        idempotencyKey: `import:${requestKey}`,
      })
      return c.json(
        paperImportResponseSchema.parse(
          successEnvelope({
            ...catalog["paper.import"].publicResult.parse(created.output),
            ...(imported.notice ? { notice: imported.notice } : {}),
          })
        )
      )
    } catch (error) {
      bytes = undefined
      void bytes
      const stopped = stoppedRead(c, error, "import")
      if (stopped) return stopped
      throw error
    }
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

  return routes
}
