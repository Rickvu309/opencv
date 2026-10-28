import { sampleApplyCards, type ApplyCard } from "./apply-fixtures.ts"
import { jobApiFetch, resetMockJobs } from "./apply-jobs-mock.ts"
import { pathOf, jsonOk, jsonError } from "./mock-http.ts"

type Store = {
  cards: ApplyCard[]
}

const store: Store = {
  cards: sampleApplyCards(),
}

function cloneCards(cards: ApplyCard[]): ApplyCard[] {
  return structuredClone(cards)
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
  resetMockJobs()
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
