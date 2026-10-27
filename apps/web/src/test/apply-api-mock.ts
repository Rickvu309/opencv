import {
  APPLY_SCAN_FETCH_FAILED,
  APPLY_SCAN_NOT_FOUND,
  applyScanHasIdentity,
  extractApplyFieldsFromHiringText,
  extractApplyFieldsFromLabeledText,
  groundApplyScanResult,
  mergeApplyScanResults,
  parseApplyScanInput,
  type ApplyCard,
} from "@workspace/domain"

import { sampleApplyCards } from "./apply-fixtures.ts"
import { jobApiFetch, resetMockJobs } from "./apply-jobs-mock.ts"
import { pathOf, jsonOk, jsonError } from "./mock-http.ts"

type Store = {
  cards: ApplyCard[]
  failNextScan: string | null
}

const store: Store = {
  cards: sampleApplyCards(),
  failNextScan: null,
}

function cloneCards(cards: ApplyCard[]): ApplyCard[] {
  return structuredClone(cards)
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

export function resetApplyApiMock() {
  store.cards = cloneCards(sampleApplyCards())
  store.failNextScan = null
  resetMockJobs()
}

export function failNextApplyScan(message: string) {
  store.failNextScan = message
}

export function getMockApplyCards() {
  return store.cards
}

export function handlesApplyRequest(input: RequestInfo | URL) {
  const path = pathOf(input)
  return path.startsWith("/api/apply")
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
