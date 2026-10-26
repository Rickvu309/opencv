import {
  DEFAULT_COACH_MODE,
  PROFILE_COMMANDS,
  type UserProfile,
} from "@workspace/domain"

import { SAMPLE_AUTHOR } from "@/features/seed/sample-author.ts"
import { authMockState } from "@/test/auth-client-mock.ts"
import { pathOf, jsonOk, jsonError } from "./mock-http.ts"

type Extras = {
  plan: "free" | "pro"
  language: "en" | "vi"
  timeZone: string
  startPage: "apply" | "paper" | "inbox" | "coach"
  notifyEmail: boolean
  notifyBrowser: boolean
  memoryEnabled: boolean
  agentChat: boolean
  agentCvs: boolean
  agentInterview: boolean
  agentEmail: boolean
  agentWeekly: boolean
  inboxSkippedAt: string | null
}

type Store = {
  profile: UserProfile
}

const store: Store = {
  profile: defaultProfile(),
}

let extras: Extras = defaultExtras()
let welcomedAt: string | null | undefined = undefined
let identityLocked = false
let weekCapped = true
let lastUpdate: Record<string, unknown> | null = null
let lastDelete: unknown = null
let emailChangeOverride:
  null | { sent: false; message: string } | { error: string } = null
const paths: string[] = []
let planRequired = false

export function setProfileUpdatePlanRequired(value: boolean) {
  planRequired = value
}

export function setMockWelcomedAt(value: string | null) {
  welcomedAt = value
}

export function setMockPlan(plan: "free" | "pro") {
  extras.plan = plan
}

export function setMockWeekUncapped() {
  weekCapped = false
}

export function getLastProfileUpdate() {
  return lastUpdate
}

export function getLastDelete() {
  return lastDelete
}

export function getProfileMockPaths() {
  return paths
}

function profilePayload() {
  const sessionUser = authMockState.data?.user
  if (sessionUser && !identityLocked) {
    store.profile = {
      ...store.profile,
      id: sessionUser.id,
      name: sessionUser.name,
      email: sessionUser.email,
    }
  }
  return {
    ...store.profile,
    ...extras,
    ...(welcomedAt !== undefined ? { welcomedAt } : {}),
  }
}

function defaultExtras(): Extras {
  return {
    plan: "free",
    language: "en",
    timeZone: "Asia/Ho_Chi_Minh",
    startPage: "apply",
    notifyEmail: true,
    notifyBrowser: false,
    memoryEnabled: true,
    agentChat: true,
    agentCvs: true,
    agentInterview: true,
    agentEmail: true,
    agentWeekly: false,
    inboxSkippedAt: null,
  }
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
  if (init?.body == null || typeof init.body !== "string") return {}
  const text = init.body
  if (text.trim() === "") return {}
  return JSON.parse(text) as unknown
}

function patchFrom(body: unknown) {
  if (body && typeof body === "object" && "input" in body) {
    const input = (body as { input?: unknown }).input
    if (input && typeof input === "object") {
      return input as Record<string, unknown>
    }
  }
  if (body && typeof body === "object") return body as Record<string, unknown>
  return {}
}

export function setMockEmailChange(
  value: null | { sent: false; message: string } | { error: string }
) {
  emailChangeOverride = value
}

export function resetProfileApiMock() {
  store.profile = defaultProfile()
  extras = defaultExtras()
  welcomedAt = undefined
  identityLocked = false
  weekCapped = true
  emailChangeOverride = null
  lastUpdate = null
  lastDelete = null
  paths.length = 0
  planRequired = false
}

export function setMockProfile(patch: Partial<UserProfile>) {
  store.profile = { ...store.profile, ...patch }
}

export function getMockCoachMode() {
  return store.profile.coachMode
}

export function handlesProfileRequest(input: RequestInfo | URL) {
  const path = pathOf(input)
  return (
    path === "/api/profile" ||
    path === `/api/commands/${PROFILE_COMMANDS.setCoachMode}` ||
    path === "/api/commands/profile.markWelcomed" ||
    path === "/api/commands/profile.update" ||
    path === "/api/commands/account.requestEmailChange" ||
    path === "/api/commands/account.delete" ||
    path === "/api/integrations" ||
    path === "/api/billing" ||
    path === "/api/coach/usage" ||
    path === "/api/account/export" ||
    path === "/api/account/photo" ||
    path === "/api/inbox/connect"
  )
}

function usagePayload() {
  const resetsAt = new Date(Date.now() + (3 * 60 + 12) * 60_000).toISOString()
  const weekReset = "2026-11-02T00:00:00.000Z"
  return {
    plan: extras.plan,
    mode: store.profile.coachMode,
    session: { capped: true, percent: 34, resetsAt },
    day: {
      capped: true,
      used: 17,
      cap: 40,
      remaining: 23,
      resetsAt,
    },
    week: weekCapped
      ? { capped: true, percent: 52, resetsAt: weekReset }
      : { capped: false, resetsAt: weekReset },
  }
}

function integrationCatalog() {
  const item = (
    id: string,
    name: string,
    line: string,
    status: "enabled" | "disabled" | "unavailable"
  ) => ({ id, name, line, status })
  return {
    groups: [
      {
        id: "enabled",
        label: "Enabled",
        items: [
          item("gmail", "Gmail", "", "disabled"),
          item("google-calendar", "Google Calendar", "", "disabled"),
          item("outlook", "Outlook", "", "unavailable"),
        ],
      },
      {
        id: "meetings",
        label: "Meetings",
        items: [
          item("zoom", "Zoom", "Add interview calls", "unavailable"),
          item(
            "google-meet",
            "Google Meet",
            "Add interview calls",
            "unavailable"
          ),
          item(
            "microsoft-teams",
            "Microsoft Teams",
            "Add interview calls",
            "unavailable"
          ),
        ],
      },
      {
        id: "files",
        label: "Files",
        items: [
          item("google-drive", "Google Drive", "Import your CV", "unavailable"),
          item("onedrive", "OneDrive", "Import your CV", "unavailable"),
          item("dropbox", "Dropbox", "Import your CV", "unavailable"),
        ],
      },
      {
        id: "notes",
        label: "Notes and design",
        items: [
          item("notion", "Notion", "Import notes", "unavailable"),
          item("figma", "Figma", "Add design work", "unavailable"),
          item("canva", "Canva", "", "unavailable"),
        ],
      },
      {
        id: "profiles",
        label: "Profiles",
        items: [
          item("linkedin", "LinkedIn", "Import experience", "unavailable"),
          item("github", "GitHub", "Add projects", "unavailable"),
          item("behance", "Behance", "", "unavailable"),
        ],
      },
    ],
  }
}

function applyUpdate(patch: Record<string, unknown>) {
  if (typeof patch.name === "string") {
    store.profile.name = patch.name
    identityLocked = true
  }
  if (patch.language === "en" || patch.language === "vi") {
    extras.language = patch.language
  }
  if (typeof patch.timeZone === "string") extras.timeZone = patch.timeZone
  if (
    patch.startPage === "apply" ||
    patch.startPage === "paper" ||
    patch.startPage === "inbox" ||
    patch.startPage === "coach"
  ) {
    extras.startPage = patch.startPage
  }
  if (typeof patch.notifyEmail === "boolean") {
    extras.notifyEmail = patch.notifyEmail
  }
  if (typeof patch.notifyBrowser === "boolean") {
    extras.notifyBrowser = patch.notifyBrowser
  }
  if (typeof patch.memoryEnabled === "boolean") {
    extras.memoryEnabled = patch.memoryEnabled
  }
  for (const key of [
    "agentChat",
    "agentCvs",
    "agentInterview",
    "agentEmail",
    "agentWeekly",
  ] as const) {
    if (typeof patch[key] === "boolean") extras[key] = patch[key]
  }
  if (
    patch.coachMode === "free" ||
    patch.coachMode === "light" ||
    patch.coachMode === "max"
  ) {
    store.profile.coachMode = patch.coachMode
  }
}

export async function profileApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response | null> {
  if (!handlesProfileRequest(input)) return null

  const path = pathOf(input)
  paths.push(path)
  const method = (init?.method ?? "GET").toUpperCase()

  if (method === "GET" && path === "/api/profile") {
    return jsonOk(profilePayload())
  }

  if (method === "GET" && path === "/api/integrations") {
    return jsonOk(integrationCatalog())
  }

  if (method === "GET" && path === "/api/billing") {
    return jsonOk({
      plan: extras.plan,
      free: {
        price: "$0 a month",
        line: "Limited Coach chats on the basic model.",
      },
      pro: {
        price: "$9 a month",
        line: "Cancel anytime.",
        benefits: [
          "Unlimited Coach chats",
          "Stronger Coach model",
          "Priority support",
          "Early access to Proof",
        ],
      },
      payment: null,
      invoices: [],
    })
  }

  if (method === "GET" && path === "/api/coach/usage") {
    return jsonOk(usagePayload())
  }

  if (method === "GET" && path === "/api/inbox/connect") {
    return jsonOk({ connected: false, url: null })
  }

  if (method === "GET" && path === "/api/account/export") {
    return new Response(
      JSON.stringify({
        profile: profilePayload(),
        documents: [],
        files: [],
        jobs: [],
        checklist: [],
        activity: [],
        chats: [],
        messages: [],
        connections: [],
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-disposition": 'attachment; filename="opencv-export.json"',
        },
      }
    )
  }

  if (method === "POST" && path === "/api/account/photo") {
    return jsonOk(profilePayload())
  }

  if (method === "POST" && path === "/api/commands/profile.markWelcomed") {
    if (welcomedAt == null) welcomedAt = new Date().toISOString()
    return jsonOk(profilePayload())
  }

  if (method === "POST" && path === "/api/commands/profile.update") {
    const patch = patchFrom(await readBody(init))
    if (
      (patch.coachMode === "light" || patch.coachMode === "max") &&
      (extras.plan === "free" || planRequired)
    ) {
      return jsonError(
        402,
        "PLAN_REQUIRED",
        "Light and Max need Pro. Stay on Free, or upgrade to change mode."
      )
    }
    applyUpdate(patch)
    lastUpdate = patch
    return jsonOk(profilePayload())
  }

  if (
    method === "POST" &&
    path === "/api/commands/account.requestEmailChange"
  ) {
    const patch = patchFrom(await readBody(init))
    const email = typeof patch.email === "string" ? patch.email : ""
    if (emailChangeOverride && "error" in emailChangeOverride) {
      return jsonError(400, "VALIDATION_ERROR", emailChangeOverride.error)
    }
    if (emailChangeOverride && emailChangeOverride.sent === false) {
      return jsonOk({
        email,
        sent: false,
        message: emailChangeOverride.message,
      })
    }
    return jsonOk({ email, sent: true })
  }

  if (method === "POST" && path === "/api/commands/account.delete") {
    lastDelete = patchFrom(await readBody(init))
    return jsonOk({ deleted: true })
  }

  if (
    method === "POST" &&
    path === `/api/commands/${PROFILE_COMMANDS.setCoachMode}`
  ) {
    return jsonError(404, "NOT_FOUND", "Not found")
  }

  return jsonError(404, "NOT_FOUND", "Not found")
}
