import { jsonOk, pathOf } from "./mock-http.ts"

export type MockShellJob = {
  id: string
  title: string
  company: string
  starred: boolean
}

type MockChat = {
  id: string
  title: string
  focusKind: null
  focusId: null
  createdAt: string
  updatedAt: string
}

const state = {
  jobs: [] as MockShellJob[],
  chats: [] as MockChat[],
  inbox: { connected: false, threads: [] as unknown[] } as unknown,
  creates: [] as unknown[],
}

export function resetShellApiMock() {
  state.jobs = []
  state.chats = []
  state.inbox = { connected: false, threads: [] }
  state.creates = []
}

export function setMockJobs(jobs: MockShellJob[]) {
  state.jobs = jobs
}

export function setMockChats(chats: MockChat[]) {
  state.chats = chats
}

export function setMockInbox(data: unknown) {
  state.inbox = data
}

export function chatCreateCalls() {
  return state.creates
}

export async function shellApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const path = pathOf(input)
  const method =
    init?.method ?? (input instanceof Request ? input.method : "GET")

  if (method === "GET" && path === "/api/chats") return jsonOk(state.chats)
  if (method === "GET" && path === "/api/jobs") return jsonOk(state.jobs)
  if (method === "GET" && path === "/api/inbox") return jsonOk(state.inbox)
  if (method === "POST" && path === "/api/commands/chat.create") {
    const body = init?.body ? JSON.parse(String(init.body)) : null
    state.creates.push(body)
    const now = new Date().toISOString()
    const chat: MockChat = {
      id: crypto.randomUUID(),
      title: "New Thread",
      focusKind: null,
      focusId: null,
      createdAt: now,
      updatedAt: now,
    }
    state.chats = [chat, ...state.chats]
    return jsonOk(chat)
  }
  return null
}
