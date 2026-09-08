import {
  PITCH_COMMANDS,
  PITCH_CONTENT_KIND,
  PITCH_CONTENT_VERSION,
  decodePitchContent,
  starterPitchDocument,
  type PitchDoc,
} from "@workspace/domain"

import { apiBaseUrl } from "@/lib/api-url.ts"

type Store = {
  doc: PitchDoc | null
  failNext: { command: string; message: string } | null
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
  store.failNext = null
}

export function getMockPitchDoc() {
  return store.doc
}

export function setMockPitchDoc(doc: PitchDoc | null) {
  store.doc = doc
}

export function failNextPitchCommand(command: string, message: string) {
  store.failNext = { command, message }
}

export function handlesPitchRequest(input: RequestInfo | URL) {
  const path = pathOf(input)
  return path === "/api/pitch" || path.includes("/api/commands/pitch.")
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
    return jsonOk(store.doc)
  }

  if (method !== "GET") {
    return jsonError(404, "UNKNOWN_COMMAND", "Unknown command")
  }

  return jsonError(404, "NOT_FOUND", "Pitch document not found")
}
