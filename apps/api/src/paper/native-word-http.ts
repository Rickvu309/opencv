import { ERROR_CODES, parseUserId } from "@workspace/domain"
import { operation } from "@workspace/domain/operations/paper/native-word"
import { Hono } from "hono"
import type { SessionVariables } from "../middleware.js"
import { CommandError } from "../registry/errors.js"
import { downloadNativeWord } from "./native-word.js"
import { WORD_PACKAGE_MEDIA_TYPE } from "./package-store.js"

export function createNativeWordRoutes() {
  const routes = new Hono<{ Variables: SessionVariables }>()
  routes.get("/:id/native-word", async (c) => {
    c.header("Cache-Control", "private, no-store")
    const parsed = operation.input.safeParse({
      docId: c.req.param("id"),
      kind: c.req.query("kind"),
      writer: jsonHeader(c.req.header("x-paper-writer")),
      basis: jsonHeader(c.req.header("x-paper-basis")),
    })
    if (!parsed.success) throw invalidDownload()
    const result = await downloadNativeWord(
      parseUserId(c.var.userId),
      parsed.data
    )
    const encoded = encodeURIComponent(result.filename).replace(
      /[!'()*]/g,
      (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`
    )
    return new Response(new Uint8Array(result.bytes), {
      headers: {
        "content-type": WORD_PACKAGE_MEDIA_TYPE,
        "content-disposition": `attachment; filename="Paper.docx"; filename*=UTF-8''${encoded}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "x-paper-basis": JSON.stringify(result.basis),
      },
    })
  })
  return routes
}
function invalidDownload() {
  return new CommandError(
    ERROR_CODES.VALIDATION_ERROR,
    "Choose the exact saved document and Word version to download."
  )
}
function jsonHeader(value: string | undefined): unknown {
  if (!value || value.length > 8192) throw invalidDownload()
  try {
    return JSON.parse(value)
  } catch {
    throw invalidDownload()
  }
}
