import { createHash, randomBytes } from "node:crypto"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest"
import { createApp } from "./app.js"
import {
  cookieHeader,
  jsonHeaders,
  sendSignInCode,
  signInWithCode,
} from "./auth.fixtures.js"
import {
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  user,
} from "./db/schema.js"
import {
  createMigratedTestDb,
  testAuthUrl,
  testSessionSecret,
  testWebOrigin,
} from "./test/harness.js"
import {
  OAUTH_CLIENT_LIMITS,
  UNKNOWN_CLIENT_DESCRIPTION,
  registrationProblem,
} from "./oauth-client-limit.js"

const HOUR = 3_600_000
const BOUND = 5
const redirectUri = "http://127.0.0.1:33418/callback"
const scope = "connection.status job.read job.write offline_access"

let database: Awaited<ReturnType<typeof createMigratedTestDb>>
let app: ReturnType<typeof createApp>
let clock: Date
let address = 0

beforeAll(async () => {
  database = await createMigratedTestDb()
  app = createApp({
    webOrigins: [testWebOrigin],
    sessionSecret: testSessionSecret,
    authUrl: testAuthUrl,
    db: database.db,
    rateLimitEnabled: true,
    sendCodeLimitEnabled: false,
    logAuthMail: true,
    oauthClientLimits: { ...OAUTH_CLIENT_LIMITS, pendingClients: BOUND },
    oauthClientClock: () => (vi.isFakeTimers() ? new Date() : clock),
  })
}, 30000)

afterAll(async () => {
  await database.client.close()
})

beforeEach(async () => {
  clock = new Date()
  await database.db.delete(oauthAccessToken)
  await database.db.delete(oauthConsent)
  await database.db.delete(oauthClient)
})

function register(body: Record<string, unknown> = {}) {
  address += 1
  return app.request("/api/auth/oauth2/register", {
    method: "POST",
    headers: jsonHeaders({ "x-real-ip": `203.0.113.${address % 250}` }),
    body: JSON.stringify({
      client_name: "Claude Code test",
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      application_type: "native",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope,
      ...body,
    }),
  })
}

async function registeredClientId(body?: Record<string, unknown>) {
  const response = await register(body)
  const json = (await response.json()) as { client_id: string }
  expect(response.status, JSON.stringify(json)).toBe(201)
  return json.client_id
}

async function clientIds() {
  return (
    await database.db.select({ id: oauthClient.clientId }).from(oauthClient)
  ).map((row) => row.id)
}

function authorizePath(clientId: string) {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state: "state-1413",
    code_challenge: createHash("sha256")
      .update(randomBytes(32).toString("base64url"))
      .digest("base64url"),
    code_challenge_method: "S256",
    resource: new URL("/mcp", testAuthUrl).href,
  })
  return `/api/auth/oauth2/authorize?${query}`
}

async function signedInPerson(email: string) {
  const { code } = await sendSignInCode(app, email)
  const cookie = cookieHeader(await signInWithCode(app, email, code!))
  const [row] = await database.db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
  return { cookie, userId: row!.id }
}

const MINUTE = 60_000

async function consentPage(clientId: string, cookie: string) {
  const authorize = await app.request(authorizePath(clientId), {
    headers: { Cookie: cookie, Accept: "application/json" },
  })
  const location =
    authorize.headers.get("location") ??
    ((await authorize.json()) as { url: string }).url
  const consentUrl = new URL(location, testWebOrigin)
  expect(consentUrl.pathname).toBe("/oauth/consent")
  return consentUrl.search.slice(1)
}

function allow(oauthQuery: string, cookie: string) {
  return app.request("/api/auth/oauth2/consent", {
    method: "POST",
    headers: jsonHeaders({ Cookie: cookie }),
    body: JSON.stringify({ accept: true, oauth_query: oauthQuery }),
  })
}

it("a flood of registrations from other addresses inside the grace period keeps a client whose person is on the consent screen", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  try {
    const person = await signedInPerson("consent-reader-1413@example.com")
    const honest = await registeredClientId({ client_name: "Honest agent" })
    const oauthQuery = await consentPage(honest, person.cookie)
    for (let index = 0; index <= BOUND * 3; index += 1)
      await registeredClientId({ client_name: `Flood ${index}` })
    clock = new Date(
      Date.now() + (OAUTH_CLIENT_LIMITS.pendingGraceMinutes - 1) * MINUTE
    )
    await registeredClientId({ client_name: "Flood last" })
    expect(await clientIds()).toContain(honest)
    const consent = await allow(oauthQuery, person.cookie)
    const body = (await consent.json()) as { url: string }
    expect(consent.status, JSON.stringify(body)).toBe(200)
    expect(new URL(body.url).searchParams.get("code")).toBeTruthy()
  } finally {
    warn.mockRestore()
  }
})

it("after the grace period removes never-approved clients beyond the newest bound, oldest first", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  try {
    const start = clock.getTime()
    vi.useFakeTimers({ toFake: ["Date"] })
    const old: string[] = []
    for (let index = 0; index < BOUND; index += 1) {
      vi.setSystemTime(start + index * 1000)
      old.push(await registeredClientId({ client_name: `Old ${index}` }))
    }
    const afterGrace =
      start + (OAUTH_CLIENT_LIMITS.pendingGraceMinutes + 1) * MINUTE
    const young: string[] = []
    for (let index = 0; index < BOUND; index += 1) {
      vi.setSystemTime(afterGrace + index * 1000)
      young.push(await registeredClientId({ client_name: `Young ${index}` }))
      const left = await clientIds()
      expect(left).toHaveLength(BOUND)
      expect(left).toEqual(
        expect.arrayContaining([
          ...old.slice(index + 1),
          ...young.slice(0, index + 1),
        ])
      )
    }
    expect(warn.mock.calls.map((call) => String(call[0]))).toContainEqual(
      expect.stringContaining(`past the bound of ${BOUND}`)
    )
  } finally {
    vi.useRealTimers()
    warn.mockRestore()
  }
})

it("answers a consent for a swept client with the register-again error, not a server error", async () => {
  const person = await signedInPerson("late-reader-1413@example.com")
  const swept = await registeredClientId({ client_name: "Read too long" })
  const oauthQuery = await consentPage(swept, person.cookie)
  clock = new Date(Date.now() + (OAUTH_CLIENT_LIMITS.pendingHours + 1) * HOUR)
  await registeredClientId({ client_name: "Trigger" })
  expect(await clientIds()).not.toContain(swept)
  const consent = await allow(oauthQuery, person.cookie)
  expect(consent.status).toBe(400)
  expect(await consent.json()).toEqual({
    error: "invalid_client",
    error_description: UNKNOWN_CLIENT_DESCRIPTION,
  })
})

it("removes a never-approved client after the window and keeps one a person approved", async () => {
  const person = await signedInPerson("agent-owner-1413@example.com")
  const abandoned = await registeredClientId({ client_name: "Abandoned" })
  const approved = await registeredClientId({ client_name: "Approved" })
  const authorize = await app.request(authorizePath(approved), {
    headers: { Cookie: person.cookie, Accept: "application/json" },
  })
  const location =
    authorize.headers.get("location") ??
    ((await authorize.json()) as { url: string }).url
  const consentUrl = new URL(location, testWebOrigin)
  expect(consentUrl.pathname).toBe("/oauth/consent")
  const consent = await app.request("/api/auth/oauth2/consent", {
    method: "POST",
    headers: jsonHeaders({ Cookie: person.cookie }),
    body: JSON.stringify({
      accept: true,
      oauth_query: consentUrl.search.slice(1),
    }),
  })
  const consentBody = (await consent.json()) as { url: string }
  expect(consent.status, JSON.stringify(consentBody)).toBe(200)
  expect(new URL(consentBody.url).searchParams.get("code")).toBeTruthy()

  clock = new Date(Date.now() + (OAUTH_CLIENT_LIMITS.pendingHours - 1) * HOUR)
  await registeredClientId({ client_name: "Before the window" })
  expect(await clientIds()).toEqual(
    expect.arrayContaining([abandoned, approved])
  )

  clock = new Date(Date.now() + (OAUTH_CLIENT_LIMITS.pendingHours + 1) * HOUR)
  await registeredClientId({ client_name: "After the window" })
  const left = await clientIds()
  expect(left).toContain(approved)
  expect(left).not.toContain(abandoned)
})

it("never removes a client with a live token, even past the window and the bound", async () => {
  const person = await signedInPerson("token-owner-1413@example.com")
  const withToken = await registeredClientId({ client_name: "Has a token" })
  await database.db.insert(oauthAccessToken).values({
    id: "access-1413",
    token: "hashed-access-1413",
    clientId: withToken,
    userId: person.userId,
    scopes: ["connection.status"],
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + HOUR),
  })
  clock = new Date(Date.now() + (OAUTH_CLIENT_LIMITS.pendingHours + 1) * HOUR)
  for (let index = 0; index < BOUND * 2; index += 1)
    await registeredClientId({ client_name: `Later ${index}` })
  expect(await clientIds()).toContain(withToken)
})

it("refuses an expired never-approved client with a message to register again", async () => {
  const expired = await registeredClientId({ client_name: "Expired" })
  clock = new Date(Date.now() + (OAUTH_CLIENT_LIMITS.pendingHours + 1) * HOUR)
  await registeredClientId({ client_name: "Trigger" })
  expect(await clientIds()).not.toContain(expired)

  const authorize = await app.request(authorizePath(expired))
  const location = new URL(authorize.headers.get("location")!, testWebOrigin)
  expect(location.searchParams.get("error")).toBe("invalid_client")
  expect(location.searchParams.get("error_description")).toBe(
    UNKNOWN_CLIENT_DESCRIPTION
  )

  const token = await app.request("/api/auth/oauth2/token", {
    method: "POST",
    headers: {
      Origin: testWebOrigin,
      "Content-Type": "application/x-www-form-urlencoded",
      "x-real-ip": "198.51.100.7",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: expired,
      code: "code-1413",
      redirect_uri: redirectUri,
      code_verifier: randomBytes(32).toString("base64url"),
    }).toString(),
  })
  const tokenBody = (await token.json()) as Record<string, unknown>
  expect(token.status, JSON.stringify(tokenBody)).toBeGreaterThanOrEqual(400)
  expect(tokenBody).toMatchObject({
    error: "invalid_client",
    error_description: UNKNOWN_CLIENT_DESCRIPTION,
  })
})

it("refuses oversized or disguised registrations with a clear error and stores nothing", async () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ client_name: "x".repeat(101) }, "client_name is longer than 100"],
    [{ client_name: "OpenCV‮etis" }, "client_name must be plain text"],
    [
      {
        redirect_uris: Array.from(
          { length: 11 },
          (_, index) => `http://127.0.0.1:${33000 + index}/callback`
        ),
      },
      "more than 10 entries",
    ],
    [
      { redirect_uris: [`http://127.0.0.1:33418/${"a".repeat(2100)}`] },
      "at most 2048 characters",
    ],
    [{ software_statement: "s".repeat(17_000) }, "larger than 16384 bytes"],
  ]
  for (const [body, message] of cases) {
    const response = await register(body)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: "invalid_client_metadata",
      error_description: expect.stringContaining(message),
    })
  }
  expect(await clientIds()).toEqual([])
})

it("accepts the names and redirect URIs real agents send", () => {
  for (const body of [
    {
      client_name: "Claude",
      redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
    },
    {
      client_name: "ChatGPT",
      redirect_uris: ["https://chatgpt.com/connector_platform_oauth_redirect"],
    },
    {
      client_name: "Visual Studio Code",
      redirect_uris: ["http://127.0.0.1:33418", "https://vscode.dev/redirect"],
    },
    { client_name: "Cursör \u2014 agent 日本", redirect_uris: [redirectUri] },
  ])
    expect(registrationProblem(JSON.stringify(body))).toBeNull()
})

it("with the sign-in code limit also mounted, a registration and a sign-in code send each reach the auth handler with their body intact", async () => {
  const both = createApp({
    webOrigins: [testWebOrigin],
    sessionSecret: testSessionSecret,
    authUrl: testAuthUrl,
    db: database.db,
    rateLimitEnabled: true,
    sendCodeLimitEnabled: true,
    logAuthMail: true,
  })
  const registration = await both.request("/api/auth/oauth2/register", {
    method: "POST",
    headers: jsonHeaders({ "x-real-ip": "198.51.100.21" }),
    body: JSON.stringify({
      client_name: "Both limits agent",
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      application_type: "native",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope,
    }),
  })
  const registered = (await registration.json()) as {
    client_id: string
    client_name: string
  }
  expect(registration.status, JSON.stringify(registered)).toBe(201)
  expect(registered.client_name).toBe("Both limits agent")
  expect(await clientIds()).toContain(registered.client_id)

  const email = "both-limits-1413@example.com"
  const { res, code } = await sendSignInCode(both, email)
  expect(res.status).toBe(200)
  expect(code).toMatch(/^\d+$/)
})
