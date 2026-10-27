import {
  APPLY_SCAN_FETCH_FAILED,
  APPLY_SCAN_NOT_FOUND,
  DEFAULT_APPLY_COMPANY,
  DEFAULT_APPLY_TITLE,
  applyScanHasIdentity,
  extractApplyFieldsFromHiringText,
  extractApplyFieldsFromLabeledText,
  generateKeyBetween,
  groundApplyScanResult,
  mergeApplyScanResults,
  parseApplyScanInput,
  type ApplyCard,
  type ApplyStage,
  type ApplyTrackKind,
} from "@workspace/domain"

import { sampleApplyCards } from "./apply-fixtures.ts"
import { jobApiFetch, resetMockJobs } from "./apply-jobs-mock.ts"
import { getMockPaperDocs } from "./paper-api-mock.ts"
import { isoNow, pathOf, jsonOk, jsonError } from "./mock-http.ts"

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

function todayIso() {
  return new Date().toISOString().slice(0, 10)
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

function positionBefore(
  stage: ApplyStage,
  beforeCardId?: string | null,
  excludeId?: string
) {
  const column = sortCards(
    store.cards.filter((card) => card.stage === stage && card.id !== excludeId)
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
  resetMockJobs()
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
  const jobs = await jobApiFetch(input, init)
  if (jobs) return jobs

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
      return jsonError(
        400,
        "VALIDATION_ERROR",
        parsed.jobUrl ? APPLY_SCAN_FETCH_FAILED : APPLY_SCAN_NOT_FOUND
      )
    }
    const extracted = mergeApplyScanResults(
      extractApplyFieldsFromLabeledText(source),
      extractApplyFieldsFromHiringText(source)
    )
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

  return jsonError(404, "UNKNOWN_COMMAND", "Unknown command")
}
