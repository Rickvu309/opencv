import {
  APPLY_COMMANDS,
  APPLY_SCAN_NOT_FOUND,
  DEFAULT_APPLY_COMPANY,
  DEFAULT_APPLY_TITLE,
  applyScanHasIdentity,
  extractApplyFieldsFromLabeledText,
  generateKeyBetween,
  groundApplyScanResult,
  parseApplyScanInput,
  type ApplyCard,
  type ApplyScanResult,
  type ApplyStage,
  type ApplyTrackKind,
} from "@workspace/domain"

import { apiBaseUrl } from "@/lib/api-url.ts"

import { sampleApplyCards } from "./apply-fixtures.ts"
import { getMockPaperDocs } from "./paper-api-mock.ts"

type Store = {
  cards: ApplyCard[]
  failNext: { command: string; message: string } | null
  failNextScan: string | null
}

const store: Store = {
  cards: sampleApplyCards(),
  failNext: null,
  failNextScan: null,
}

function cloneCards(cards: ApplyCard[]): ApplyCard[] {
  return structuredClone(cards)
}

function isoNow() {
  return new Date().toISOString()
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
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

function sortCards(cards: ApplyCard[]) {
  return [...cards].sort((a, b) => {
    if (a.stage !== b.stage) return a.stage < b.stage ? -1 : 1
    if (a.position !== b.position) return a.position < b.position ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

function positionBefore(stage: ApplyStage, beforeCardId?: string | null, excludeId?: string) {
  const column = sortCards(
    store.cards.filter(
      (card) => card.stage === stage && card.id !== excludeId
    )
  )
  if (beforeCardId == null) {
    return generateKeyBetween(column.at(-1)?.position ?? null, null)
  }
  const index = column.findIndex((card) => card.id === beforeCardId)
  if (index === -1) {
    return generateKeyBetween(column.at(-1)?.position ?? null, null)
  }
  const right = column[index]!
  const left = index > 0 ? column[index - 1]! : null
  return generateKeyBetween(left?.position ?? null, right.position)
}

export function resetApplyApiMock() {
  store.cards = cloneCards(sampleApplyCards())
  store.failNext = null
  store.failNextScan = null
}

export function failNextApplyScan(message: string) {
  store.failNextScan = message
}

export function failNextApplyCommand(command: string, message: string) {
  store.failNext = { command, message }
}

export function getMockApplyCards() {
  return store.cards
}

export function handlesApplyRequest(input: RequestInfo | URL) {
  const path = pathOf(input)
  return path.startsWith("/api/apply") || path.includes("/api/commands/apply.")
}

export async function applyApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response | null> {
  const path = pathOf(input)
  const method = (init?.method ?? "GET").toUpperCase()

  if (!handlesApplyRequest(input)) return null

  if (
    store.failNext &&
    method === "POST" &&
    path.endsWith(store.failNext.command)
  ) {
    const failure = store.failNext
    store.failNext = null
    return jsonError(400, "VALIDATION_ERROR", failure.message)
  }

  if (method === "POST" && path === "/api/apply/scan") {
    if (store.failNextScan) {
      const message = store.failNextScan
      store.failNextScan = null
      return jsonError(400, "VALIDATION_ERROR", message)
    }
    const body = (await readBody(init)) as {
      jobUrl?: string | null
      jdText?: string
    }
    const parsed = parseApplyScanInput({
      jobUrl: body.jobUrl ?? "",
      jdText: body.jdText ?? "",
    })
    if (!parsed.ok) {
      return jsonError(400, "VALIDATION_ERROR", parsed.message)
    }
    const source =
      parsed.jdText ??
      (parsed.jobUrl?.includes("careers.example.com/pm-intern")
        ? "Example is hiring a PM intern."
        : "")
    if (!source) {
      return jsonError(400, "VALIDATION_ERROR", APPLY_SCAN_NOT_FOUND)
    }
    const labeled = extractApplyFieldsFromLabeledText(source)
    const extracted: ApplyScanResult = applyScanHasIdentity(labeled)
      ? labeled
      : parsed.jdText
        ? {
            title: source.includes("Associate PM intern")
              ? "Associate PM intern"
              : null,
            company: source.includes("Local startup") ? "Local startup" : null,
            note: source.includes("Hanoi") ? "Hanoi" : null,
          }
        : { title: "PM intern", company: "Example", note: null }
    const grounded = groundApplyScanResult(source, extracted)
    if (!applyScanHasIdentity(grounded)) {
      return jsonError(400, "VALIDATION_ERROR", APPLY_SCAN_NOT_FOUND)
    }
    return jsonOk(grounded)
  }

  if (method === "GET" && path === "/api/apply") {
    return jsonOk(sortCards(store.cards))
  }

  const detail = /^\/api\/apply\/([^/]+)$/.exec(path)
  if (method === "GET" && detail) {
    const card = store.cards.find((item) => item.id === detail[1])
    if (!card) return jsonError(404, "NOT_FOUND", "Apply card not found")
    return jsonOk(card)
  }

  if (
    method === "POST" &&
    path === `/api/commands/${APPLY_COMMANDS.createCard}`
  ) {
    const body = (await readBody(init)) as {
      title?: string
      company?: string
      note?: string
      stage?: ApplyStage
      jobUrl?: string | null
      trackDate?: string
      trackKind?: ApplyTrackKind
      starred?: boolean
    }
    const stage = body.stage ?? "inbox"
    const now = isoNow()
    const created: ApplyCard = {
      id: crypto.randomUUID(),
      title: body.title?.trim() || DEFAULT_APPLY_TITLE,
      company: body.company?.trim() || DEFAULT_APPLY_COMPANY,
      note: body.note ?? "",
      stage,
      position: positionBefore(stage, null),
      starred: body.starred ?? false,
      jobUrl: body.jobUrl ?? null,
      trackDate: body.trackDate ?? todayIso(),
      trackKind: body.trackKind ?? "followup",
      createdAt: now,
      updatedAt: now,
    }
    store.cards.push(created)
    return jsonOk(created)
  }

  if (
    method === "POST" &&
    path === `/api/commands/${APPLY_COMMANDS.updateCard}`
  ) {
    const body = (await readBody(init)) as Partial<ApplyCard> & {
      cardId?: string
    }
    const card = store.cards.find((item) => item.id === body.cardId)
    if (!card) return jsonError(404, "NOT_FOUND", "Apply card not found")
    if (body.title !== undefined) card.title = body.title
    if (body.company !== undefined) card.company = body.company
    if (body.note !== undefined) card.note = body.note
    if (body.jobUrl !== undefined) card.jobUrl = body.jobUrl
    if (body.trackDate !== undefined) card.trackDate = body.trackDate
    if (body.trackKind !== undefined) card.trackKind = body.trackKind
    card.updatedAt = isoNow()
    return jsonOk(card)
  }

  if (method === "POST" && path === `/api/commands/${APPLY_COMMANDS.moveCard}`) {
    const body = (await readBody(init)) as {
      cardId?: string
      stage?: ApplyStage
      beforeCardId?: string | null
    }
    const card = store.cards.find((item) => item.id === body.cardId)
    if (!card) return jsonError(404, "NOT_FOUND", "Apply card not found")
    if (!body.stage) {
      return jsonError(400, "VALIDATION_ERROR", "Stage is required")
    }
    card.stage = body.stage
    card.position = positionBefore(body.stage, body.beforeCardId, card.id)
    card.updatedAt = isoNow()
    return jsonOk(card)
  }

  if (
    method === "POST" &&
    path === `/api/commands/${APPLY_COMMANDS.toggleStar}`
  ) {
    const body = (await readBody(init)) as { cardId?: string }
    const card = store.cards.find((item) => item.id === body.cardId)
    if (!card) return jsonError(404, "NOT_FOUND", "Apply card not found")
    card.starred = !card.starred
    card.updatedAt = isoNow()
    return jsonOk(card)
  }

  if (
    method === "POST" &&
    path === `/api/commands/${APPLY_COMMANDS.deleteCard}`
  ) {
    const body = (await readBody(init)) as { cardId?: string }
    const index = store.cards.findIndex((item) => item.id === body.cardId)
    if (index === -1) return jsonError(404, "NOT_FOUND", "Apply card not found")
    const [removed] = store.cards.splice(index, 1)
    for (const doc of getMockPaperDocs()) {
      if (doc.applyCardId === removed!.id) doc.applyCardId = null
    }
    return jsonOk({ id: removed!.id })
  }

  return jsonError(404, "UNKNOWN_COMMAND", "Unknown command")
}
