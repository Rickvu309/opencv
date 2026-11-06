import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createAuth } from "./auth.js"
import { oauthResource } from "./db/schema.js"
import {
  BROWSER_REDIRECT_AUTH_PATHS,
  OAUTH_AUTH_PATHS,
  SERVED_AUTH_PATHS,
  WEB_CALLED_AUTH_PATHS,
  isServedAuthPath,
} from "./auth-routes.js"
import { createAuthedApp } from "./auth.fixtures.js"
import {
  createMigratedTestDb,
  testAuthUrl,
  testWebOrigin,
} from "./test/harness.js"

type LibraryEndpoint = {
  path?: string
  options?: { method?: string | string[]; metadata?: { SERVER_ONLY?: boolean } }
}

let client: PGlite
let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
let app: ReturnType<typeof createAuthedApp>

beforeAll(async () => {
  ;({ client, db } = await createMigratedTestDb())
  app = createAuthedApp(db as never, testAuthUrl)
})

afterAll(async () => {
  await client.close()
})

function httpEndpoints() {
  const auth = createAuth({
    db: db as never,
    sessionSecret: "test-session-secret-that-is-at-least-32ch",
    authUrl: testAuthUrl,
    webOrigins: [testWebOrigin],
    googleClientId: "google-id",
    googleClientSecret: "google-secret",
  })
  return (Object.values(auth.api) as LibraryEndpoint[])
    .filter(
      (endpoint): endpoint is LibraryEndpoint & { path: string } =>
        typeof endpoint.path === "string" &&
        !endpoint.options?.metadata?.SERVER_ONLY
    )
    .map((endpoint) => ({
      path: endpoint.path,
      methods: [endpoint.options?.method ?? "GET"].flat().map(String),
    }))
}

function webSourceFiles() {
  const root = fileURLToPath(new URL("../../web/src", import.meta.url))
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file))
    .filter((file) => !/\.test\.tsx?$|(^|\/)test\//.test(file))
    .map((file) => readFileSync(`${root}/${file}`, "utf8"))
}

function kebab(name: string) {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function clientCallChains(source: string) {
  const chains = new Set<string>()
  const aliases = new Map<string, string>()
  for (const match of source.matchAll(
    /const (\w+) = authClient((?:\.[A-Za-z]+)+)/g
  )) {
    aliases.set(match[1]!, match[2]!.slice(1))
  }
  for (const match of source.matchAll(/\bauthClient((?:\.[A-Za-z]+)+)/g)) {
    chains.add(match[1]!.slice(1))
  }
  for (const [alias, chain] of aliases) {
    for (const match of source.matchAll(
      new RegExp(`\\b${alias}\\.(\\w+)`, "g")
    )) {
      chains.add(`${chain}.${match[1]}`)
    }
    chains.delete(chain)
  }
  return [...chains]
}

function pathOfClientChain(chain: string) {
  const parts = chain.split(".").filter((part) => part !== "bind")
  if (parts[0] === "useSession") return "/get-session"
  return `/${parts.map(kebab).join("/")}`
}

function webCalledPaths() {
  return [
    ...new Set(
      webSourceFiles().flatMap(clientCallChains).map(pathOfClientChain)
    ),
  ].sort()
}

function concretePath(path: string) {
  return path.replace(/:\w+/g, "x")
}

function spellings(path: string) {
  const concrete = concretePath(path)
  return [
    `/api/auth${concrete}`,
    `/api/auth${concrete}/`,
    `/api/auth/${concrete}`,
    `/api/auth${concrete.toUpperCase()}`,
    `/api/auth${concrete.replace(/[a-z]/, (letter) => `%${letter.charCodeAt(0).toString(16)}`)}`,
    `/api/auth${concrete}?x=1`,
    `/api/auth${concrete}/..%2f${concrete.slice(1)}`,
  ]
}

describe("the auth routes the api serves", () => {
  it("finishes provider initialization before an unserved auth request returns", async () => {
    const database = await createMigratedTestDb()
    try {
      const isolatedApp = createAuthedApp(database.db as never, testAuthUrl)
      expect(
        (
          await isolatedApp.request("/api/auth/sign-up/email", {
            method: "POST",
          })
        ).status
      ).toBe(404)
      expect(await database.db.select().from(oauthResource)).toMatchObject([
        { identifier: `${testAuthUrl}/mcp` },
      ])
    } finally {
      await database.client.close()
    }
  })

  it("the paths the web calls are exactly the web-called list", () => {
    expect(webCalledPaths()).toEqual([...WEB_CALLED_AUTH_PATHS].sort())
  })

  it("every served path is a route the auth library registers", () => {
    const registered = httpEndpoints().map((endpoint) => endpoint.path)
    expect(
      SERVED_AUTH_PATHS.filter((path) => !registered.includes(path))
    ).toEqual([])
  })

  it("every auth route that is reachable over http and not served answers 404 in every spelling and method", async () => {
    const unserved = httpEndpoints().filter(
      (endpoint) => !SERVED_AUTH_PATHS.includes(endpoint.path)
    )
    expect(unserved.length).toBeGreaterThan(10)
    const answered: string[] = []
    for (const endpoint of unserved) {
      for (const spelling of spellings(endpoint.path)) {
        for (const method of endpoint.methods) {
          const res = await app.request(spelling, {
            method,
            headers: {
              Origin: testWebOrigin,
              "Content-Type": "application/json",
            },
            body: method === "GET" ? undefined : JSON.stringify({}),
          })
          if (res.status !== 404) {
            answered.push(`${method} ${spelling} -> ${res.status}`)
          }
        }
      }
    }
    expect(answered, "auth routes the library answered").toEqual([])
  })

  it("a served path is recognised and reaches the library", async () => {
    for (const path of SERVED_AUTH_PATHS) {
      expect(isServedAuthPath(`/api/auth${concretePath(path)}`), path).toBe(
        true
      )
    }
    for (const path of WEB_CALLED_AUTH_PATHS) {
      const res = await app.request(`/api/auth${path}`, {
        method: "POST",
        headers: {
          Origin: testWebOrigin,
          "Content-Type": "application/json",
        },
        body: "{}",
      })
      expect(res.status, path).not.toBe(404)
    }
  })

  it("a Google callback with a bad state ends on the web sign-in page, not a 404", async () => {
    const googleApp = createAuthedApp(db as never, testAuthUrl, {
      googleEnabled: true,
      googleClientId: "google-id",
      googleClientSecret: "google-secret",
    })
    const res = await googleApp.request(
      "/api/auth/callback/google?code=x&state=forged",
      { method: "GET", redirect: "manual" }
    )
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe(
      `${testWebOrigin}/sign-in?error=state_mismatch`
    )
  })

  it("only the explicit browser and OAuth paths are served", () => {
    expect([...SERVED_AUTH_PATHS].sort()).toEqual(
      [
        ...WEB_CALLED_AUTH_PATHS,
        ...BROWSER_REDIRECT_AUTH_PATHS,
        ...OAUTH_AUTH_PATHS,
      ].sort()
    )
  })
})
