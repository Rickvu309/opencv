import { randomUUID } from "node:crypto"

import type { TestDatabase } from "../../db/context.js"
import {
  fixturePackage,
  paragraph,
} from "../../paper/import/package-fixtures.js"
import { authHeaders, testWebOrigin } from "../harness.js"
import { textPdf } from "./route-files.js"
import { nativeWordRouteCase } from "./native-word.js"

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export type Person = {
  userId: string
  cookie: string
  db: TestDatabase
  command(name: string, input: unknown): Promise<Record<string, unknown>>
  fetch(request: Request): Promise<Response>
}

export type RouteCase = {
  method: Method
  path: string
  arrange(as: Person): Promise<Record<string, string>>
  request(
    as: Person,
    ids: Record<string, string>,
    signal?: AbortSignal
  ): Request
}

export const REGISTRY_ROUTES = [
  "POST /api/commands/:name",
  "POST /api/reads/:name",
]

export const LIBRARY_MOUNTS = ["/api/auth/"]

const ORIGIN = "http://localhost"

function filled(path: string, ids: Record<string, string>) {
  return path.replace(/:([a-zA-Z]+)/g, (_, key: string) => {
    const value = ids[key]
    if (value === undefined) throw new Error(`no id for :${key} in ${path}`)
    return encodeURIComponent(value)
  })
}

type Arrange = RouteCase["arrange"]

const none: Arrange = async () => ({})

function get(path: string, arrange: Arrange = none): RouteCase {
  return {
    method: "GET",
    path,
    arrange,
    request: (as, ids, signal) =>
      new Request(ORIGIN + filled(path, ids), {
        headers: authHeaders(as.cookie),
        signal,
      }),
  }
}

function postJson(
  path: string,
  body: (ids: Record<string, string>) => unknown,
  arrange: Arrange = none
): RouteCase {
  return {
    method: "POST",
    path,
    arrange,
    request: (as, ids, signal) =>
      new Request(ORIGIN + filled(path, ids), {
        method: "POST",
        headers: authHeaders(as.cookie),
        body: JSON.stringify(body(ids)),
        signal,
      }),
  }
}

type Upload = { bytes: Uint8Array; name: string; type: string }

function postForm(
  path: string,
  upload: (ids: Record<string, string>) => Upload,
  arrange: Arrange = none
): RouteCase {
  return {
    method: "POST",
    path,
    arrange,
    request: (as, ids, signal) => {
      const file = upload(ids)
      const form = new FormData()
      form.set(
        "file",
        new File([new Uint8Array(file.bytes)], file.name, { type: file.type })
      )
      return new Request(ORIGIN + filled(path, ids), {
        method: "POST",
        headers: { Origin: testWebOrigin, Cookie: as.cookie },
        body: form,
        signal,
      })
    },
  }
}

function idIn(value: Record<string, unknown>, key: string) {
  const id = value[key]
  if (typeof id !== "string")
    throw new Error(`no ${key} in ${JSON.stringify(value)}`)
  return id
}

async function chat(as: Person) {
  const made = await as.command("chat.create", { title: "Route" })
  return { id: idIn(made, "id") }
}

const WORD_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const wordUpload: Upload = {
  bytes: fixturePackage(paragraph("Ada Lovelace Analyst at Northwind")),
  name: "Imported CV.docx",
  type: WORD_TYPE,
}

async function uploadedFile(as: Person) {
  const response = await as.fetch(
    postForm("/api/paper/files", () => pngUpload).request(as, {})
  )
  if (response.status !== 200)
    throw new Error(`upload failed: ${response.status}`)
  const body = (await response.json()) as { data: { id: string } }
  return { id: body.data.id }
}

const pngUpload: Upload = {
  bytes: Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
      "base64"
    )
  ),
  name: "photo.png",
  type: "image/png",
}

const textUpload: Upload = {
  bytes: new TextEncoder().encode("Ada Lovelace\nAnalyst at Northwind"),
  name: "Imported CV.txt",
  type: "text/plain",
}

const pdfUpload: Upload = {
  bytes: textPdf("Ada Lovelace Analyst at Northwind"),
  name: "Imported CV.pdf",
  type: "application/pdf",
}

export const IMPORT_CASES = {
  docx: postForm("/api/paper/import", () => wordUpload),
  pdf: postForm("/api/paper/import", () => pdfUpload),
  txt: postForm("/api/paper/import", () => textUpload),
}

const mcpCase: RouteCase = {
  method: "POST",
  path: "/mcp",
  arrange: none,
  request: (_as, _ids, signal) =>
    new Request(`${ORIGIN}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      signal,
    }),
}

export const ROUTE_CASES: readonly RouteCase[] = [
  get("/health"),
  get("/health/deep"),
  get("/.well-known/oauth-authorization-server"),
  get("/.well-known/oauth-authorization-server/api/auth"),
  get("/.well-known/oauth-protected-resource/mcp"),
  get("/api/public-config"),
  get("/api/session"),
  get("/api/coach/tasks/:id/events", async () => ({ id: randomUUID() })),
  postJson(
    "/api/chats/:id/turns",
    () => ({ message: "Hello", requestId: randomUUID() }),
    chat
  ),
  postForm("/api/paper/letter-attachment", () => textUpload),
  IMPORT_CASES.docx,
  IMPORT_CASES.pdf,
  IMPORT_CASES.txt,
  postForm("/api/paper/files", () => pngUpload),
  get("/api/paper/files/:id/bytes", uploadedFile),
  nativeWordRouteCase,
  get("/api/inbox/connect"),
  get("/api/inbox/callback"),
  postForm("/api/account/photo", () => pngUpload),
  get("/api/account/export"),
  mcpCase,
]

export type RouteSource = {
  routes: readonly { method: string; path: string }[]
}

function isMount(route: { method: string; path: string }) {
  return (
    (route.method === "ALL" && route.path.endsWith("*")) ||
    LIBRARY_MOUNTS.some((prefix) => route.path.startsWith(prefix))
  )
}

export function routeGaps(
  app: RouteSource,
  cases: readonly RouteCase[]
): string[] {
  const served = new Set(
    app.routes
      .filter((route) => !isMount(route))
      .map((route) =>
        route.method === "ALL"
          ? `POST ${route.path}`
          : `${route.method} ${route.path}`
      )
  )
  const covered = new Set(cases.map((row) => `${row.method} ${row.path}`))
  const gaps = [...served]
    .filter((route) => !REGISTRY_ROUTES.includes(route) && !covered.has(route))
    .sort()
    .map(
      (route) =>
        `${route} has no route case. Add one to apps/api/src/test/routes/route-cases.ts`
    )
  const stale = [...covered]
    .filter((route) => !served.has(route))
    .sort()
    .map(
      (route) =>
        `${route} has a route case but the app serves no such route. Delete the case.`
    )
  return [...gaps, ...stale]
}
