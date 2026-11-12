import { jsonOk, pathOf, urlOf } from "./mock-http.ts"

export { chatCreateCalls, setMockChats } from "./chat-api-mock.ts"

export type MockShellJob = {
  id: string
  title: string
  company: string
  starred: boolean
}

export type MockSearchHits = {
  jobs: { id: string; title: string; company: string; stage: string | null }[]
  documents: { id: string; name: string; kind: string }[]
  chats: { id: string; title: string }[]
}

const emptyHits = (): MockSearchHits => ({
  jobs: [],
  documents: [],
  chats: [],
})

const state = {
  jobs: [] as MockShellJob[],
  inbox: { connected: false, threads: [] as unknown[] } as unknown,
  searchHits: emptyHits(),
  searchQueries: [] as string[],
}

export function resetShellApiMock() {
  state.jobs = []
  state.inbox = { connected: false, threads: [] }
  state.searchHits = emptyHits()
  state.searchQueries = []
}

export function setMockJobs(jobs: MockShellJob[]) {
  state.jobs = jobs
}

export function setMockInbox(data: unknown) {
  state.inbox = data
}

export function setMockSearch(hits: MockSearchHits) {
  state.searchHits = hits
}

export function searchQueries() {
  return state.searchQueries
}

export async function shellApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const path = pathOf(input)
  const method =
    init?.method ?? (input instanceof Request ? input.method : "GET")

  if (method === "GET" && path === "/api/search") {
    state.searchQueries.push(urlOf(input).searchParams.get("q") ?? "")
    return jsonOk(state.searchHits)
  }
  if (method === "GET" && path === "/api/jobs") return jsonOk(state.jobs)
  if (method === "GET" && path === "/api/inbox") return jsonOk(state.inbox)
  return null
}
