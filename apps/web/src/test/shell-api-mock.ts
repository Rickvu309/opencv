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
  notifies: [] as { topic: string }[],
}

export function resetShellApiMock() {
  state.jobs = []
  state.inbox = { connected: false, threads: [] }
  state.searchHits = emptyHits()
  state.searchQueries = []
  state.notifies = []
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

export function notifyCalls() {
  return state.notifies
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
  if (method === "POST" && path === "/api/commands/notify.request") {
    const raw = typeof init?.body === "string" ? JSON.parse(init.body) : {}
    const topic =
      typeof raw.topic === "string"
        ? raw.topic
        : typeof raw.input?.topic === "string"
          ? raw.input.topic
          : ""
    state.notifies.push({ topic })
    return jsonOk({
      id: `notify-${topic}`,
      topic,
      createdAt: "2026-10-27T00:00:00.000Z",
    })
  }
  if (method === "GET" && path === "/api/jobs") return jsonOk(state.jobs)
  if (method === "GET" && path === "/api/inbox") return jsonOk(state.inbox)
  return null
}
