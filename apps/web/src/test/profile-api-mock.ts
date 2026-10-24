import {
  DEFAULT_COACH_MODE,
  PROFILE_COMMANDS,
  coachModeSchema,
  type CoachMode,
  type UserProfile,
} from "@workspace/domain"

import { SAMPLE_AUTHOR } from "@/features/seed/sample-author.ts"
import { pathOf, jsonOk, jsonError } from "./mock-http.ts"

type Store = {
  profile: UserProfile
}

const store: Store = {
  profile: defaultProfile(),
}

function defaultProfile(): UserProfile {
  return {
    id: "user_test",
    name: SAMPLE_AUTHOR.name,
    email: SAMPLE_AUTHOR.email,
    emailVerified: false,
    image: null,
    coachMode: DEFAULT_COACH_MODE,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

async function readBody(init?: RequestInit): Promise<unknown> {
  if (init?.body == null) return {}
  const text = String(init.body)
  if (text.trim() === "") return {}
  return JSON.parse(text) as unknown
}

export function resetProfileApiMock() {
  store.profile = defaultProfile()
}

export function getMockCoachMode() {
  return store.profile.coachMode
}

export function handlesProfileRequest(input: RequestInfo | URL) {
  const path = pathOf(input)
  return (
    path === "/api/profile" ||
    path === `/api/commands/${PROFILE_COMMANDS.setCoachMode}`
  )
}

export async function profileApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response | null> {
  if (!handlesProfileRequest(input)) return null

  const path = pathOf(input)
  const method = (init?.method ?? "GET").toUpperCase()

  if (method === "GET" && path === "/api/profile") {
    return jsonOk(store.profile)
  }

  if (
    method === "POST" &&
    path === `/api/commands/${PROFILE_COMMANDS.setCoachMode}`
  ) {
    const body = (await readBody(init)) as { mode?: unknown }
    const parsed = coachModeSchema.safeParse(body.mode)
    if (!parsed.success) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid mode")
    }
    store.profile = {
      ...store.profile,
      coachMode: parsed.data as CoachMode,
      updatedAt: new Date().toISOString(),
    }
    return jsonOk(store.profile)
  }

  return jsonError(404, "NOT_FOUND", "Not found")
}
