import {
  ERROR_CODES,
  PAPER_PACKAGE_LIMITS,
  errorEnvelope,
  paperPackageStageInputSchema,
  personActor,
  successEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"
import { ZodError } from "zod"

import type { Auth } from "../auth.js"
import type { AppDatabase } from "../db/context.js"
import {
  handleApiError,
  requireSession,
  type SessionVariables,
} from "../middleware.js"
import { registry } from "../registry/registry.js"
import { CommandError } from "../registry/errors.js"
import { PaperPackageRefusal } from "./package-errors.js"
import {
  WORD_PACKAGE_MEDIA_TYPE,
  exportWordPackage,
  stageWordPackage,
} from "./package-store.js"

async function uploadBytes(request: Request) {
  if (
    Number(request.headers.get("content-length")) >
    PAPER_PACKAGE_LIMITS.uploadBytes
  )
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "Choose a Word file smaller than 8 MiB."
    )
  const chunks: Uint8Array[] = []
  let size = 0
  const reader = request.body?.getReader()
  if (reader) {
    for (;;) {
      const result = await reader.read()
      if (result.done) break
      size += result.value.byteLength
      if (size > PAPER_PACKAGE_LIMITS.uploadBytes) {
        await reader.cancel()
        throw new CommandError(
          ERROR_CODES.VALIDATION_ERROR,
          "Choose a Word file smaller than 8 MiB."
        )
      }
      chunks.push(result.value)
    }
  }
  return Buffer.concat(chunks)
}

export function createPaperPackageRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = new Hono<{ Variables: SessionVariables }>()
  routes.onError((error, c) => {
    if (error instanceof ZodError || error instanceof PaperPackageRefusal)
      return c.json(
        errorEnvelope(
          ERROR_CODES.VALIDATION_ERROR,
          error instanceof PaperPackageRefusal
            ? error.message
            : "Check the Word file, document and version fields."
        ),
        400
      )
    return handleApiError(error, c)
  })
  routes.use("*", async (c, next) => {
    if (process.env.PAPER_PACKAGE_ENABLED !== "true") return c.notFound()
    c.header("cache-control", "private, no-store")
    return requireSession(auth, db)(c, next)
  })
  routes.post("/stage", async (c) => {
    if (c.req.header("content-type") !== WORD_PACKAGE_MEDIA_TYPE)
      throw new CommandError(
        ERROR_CODES.VALIDATION_ERROR,
        "Upload a Word document as a DOCX file."
      )
    const input = paperPackageStageInputSchema.parse({
      requestId: c.req.header("idempotency-key"),
      name: c.req.query("name"),
      kind: c.req.query("kind"),
    })
    const staged = await stageWordPackage(
      c.var.userId,
      input,
      await uploadBytes(c.req.raw)
    )
    return c.json(successEnvelope(staged), 201)
  })
  routes.get("/", async (c) =>
    c.json(
      successEnvelope(
        await registry.read(
          "paper.read",
          { view: "library", after: c.req.query("after") },
          personActor(c.var.userId)
        )
      )
    )
  )
  routes.get("/:docId/read", async (c) => {
    const page = await registry.read(
      "paper.read",
      {
        docId: c.req.param("docId"),
        at: c.req.query("at"),
        cursor: c.req.query("cursor"),
      },
      personActor(c.var.userId)
    )
    return c.json(successEnvelope(page))
  })
  routes.get("/:docId/export", async (c) => {
    const exported = await exportWordPackage(
      c.var.userId,
      c.req.param("docId"),
      c.req.query("at") ?? ""
    )
    const filename = encodeURIComponent(exported.metadata.name).replaceAll(
      "'",
      "%27"
    )
    return new Response(new Uint8Array(exported.bytes), {
      headers: {
        "content-type": WORD_PACKAGE_MEDIA_TYPE,
        "content-disposition": `attachment; filename="document.docx"; filename*=UTF-8''${filename}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        etag: `"${exported.metadata.packageHash}"`,
      },
    })
  })
  return routes
}
