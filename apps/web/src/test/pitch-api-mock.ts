import {
  PITCH_COMMANDS,
  PITCH_CONTENT_KIND,
  PITCH_CONTENT_VERSION,
  decodePitchContent,
  isPitchPublicSlug,
  pitchHandle,
  starterPitchDocument,
  type PitchDoc,
  type PitchDocument,
  type PublicPitch,
} from "@workspace/domain"

import { authMockState, TEST_SESSION_USER } from "@/test/auth-client-mock.ts"

import { apiBaseUrl } from "@/lib/api-url.ts"

type PublicAuthor = {
  name: string
  email: string
  image: string | null
}

type Store = {
  doc: PitchDoc | null
  author: PublicAuthor
  failNext: { command: string; message: string } | null
}

function defaultAuthor(): PublicAuthor {
  return {
    name: TEST_SESSION_USER.name,
    email: TEST_SESSION_USER.email,
    image: TEST_SESSION_USER.image,
  }
}

function sessionAuthor(): PublicAuthor {
  const user = authMockState.data?.user
  if (!user) return store.author
  return {
    name: user.name,
    email: user.email,
    image: user.image,
  }
}

function isoNow() {
  return new Date().toISOString()
}

function starterDoc(): PitchDoc {
  return {
    id: "55555555-5555-7555-8555-555555555555",
    kind: PITCH_CONTENT_KIND,
    content: starterPitchDocument(),
    contentVersion: PITCH_CONTENT_VERSION,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
  }
}

const store: Store = {
  doc: starterDoc(),
  author: defaultAuthor(),
  failNext: null,
}

function pathOf(input: RequestInfo | URL) {
  if (typeof input === "string") return new URL(input, apiBaseUrl).pathname
  if (input instanceof URL) return input.pathname
  return new URL(input.url, apiBaseUrl).pathname
}

function jsonOk<T>(data: T, status = 200) {
  return Response.json({ ok: true, data }, { status })
}

function jsonError(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status })
}

async function readBody(init?: RequestInit): Promise<unknown> {
  if (init?.body == null) return {}
  const text = String(init.body)
  if (text.trim() === "") return {}
  return JSON.parse(text) as unknown
}

export function resetPitchApiMock() {
  store.doc = starterDoc()
  store.author = defaultAuthor()
  store.failNext = null
}

export function getMockPitchDoc() {
  return store.doc
}

export function setMockPitchDoc(doc: PitchDoc | null) {
  store.doc = doc
  store.author = sessionAuthor()
}

export function failNextPitchCommand(command: string, message: string) {
  store.failNext = { command, message }
}

function publicSlugFromPath(path: string) {
  const prefix = "/api/pitch/public/"
  if (!path.startsWith(prefix)) return null
  return decodeURIComponent(path.slice(prefix.length))
}

function publishedContent(doc: PitchDoc | null): PitchDocument | null {
  if (!doc) return null
  const decoded = decodePitchContent(doc.kind, doc.contentVersion, doc.content)
  if (!decoded.ok || !decoded.data.published) return null
  return decoded.data
}

function publicPitchForSlug(slug: string): PublicPitch | null {
  if (!isPitchPublicSlug(slug)) return null
  const content = publishedContent(store.doc)
  if (!content) return null
  const author = store.author
  if ((pitchHandle(author.name) || "you") !== slug) return null
  return {
    slug,
    author,
    kind: PITCH_CONTENT_KIND,
    content,
    contentVersion: store.doc?.contentVersion ?? PITCH_CONTENT_VERSION,
  }
}

export function handlesPitchRequest(input: RequestInfo | URL) {
  const path = pathOf(input)
  return (
    path === "/api/pitch" ||
    path.startsWith("/api/pitch/public/") ||
    path.includes("/api/commands/pitch.")
  )
}

export async function pitchApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response | null> {
  const path = pathOf(input)
  const method = (init?.method ?? "GET").toUpperCase()

  if (!handlesPitchRequest(input)) return null

  if (
    store.failNext &&
    method === "POST" &&
    path.endsWith(store.failNext.command)
  ) {
    const failure = store.failNext
    store.failNext = null
    return jsonError(400, "VALIDATION_ERROR", failure.message)
  }

  if (method === "GET" && path === "/api/pitch") {
    if (!store.doc) return jsonError(404, "NOT_FOUND", "Pitch document not found")
    return jsonOk(store.doc)
  }

  const publicSlug = publicSlugFromPath(path)
  if (method === "GET" && publicSlug !== null) {
    const page = publicPitchForSlug(publicSlug)
    if (!page) return jsonError(404, "NOT_FOUND", "Pitch not found")
    return jsonOk(page)
  }

  if (method === "POST" && path === `/api/commands/${PITCH_COMMANDS.update}`) {
    const body = (await readBody(init)) as {
      content?: unknown
      contentVersion?: number
    }
    const decoded = decodePitchContent(
      PITCH_CONTENT_KIND,
      body.contentVersion ?? PITCH_CONTENT_VERSION,
      body.content
    )
    if (!decoded.ok) {
      return jsonError(400, "VALIDATION_ERROR", decoded.message)
    }
    const now = isoNow()
    const existing = store.doc
    store.doc = {
      id: existing?.id ?? crypto.randomUUID(),
      kind: PITCH_CONTENT_KIND,
      content: decoded.data,
      contentVersion: body.contentVersion ?? PITCH_CONTENT_VERSION,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    store.author = sessionAuthor()
    return jsonOk(store.doc)
  }

  if (method !== "GET") {
    return jsonError(404, "UNKNOWN_COMMAND", "Unknown command")
  }

  return jsonError(404, "NOT_FOUND", "Pitch document not found")
}
