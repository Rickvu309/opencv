import { randomUUID } from "node:crypto"
import { get } from "node:http"
import { serve } from "@hono/node-server"
import {
  Client,
  StreamableHTTPClientTransport,
  discoverOAuthProtectedResourceMetadata,
  discoverAuthorizationServerMetadata,
  exchangeAuthorization,
  startAuthorization,
} from "@modelcontextprotocol/client"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { z } from "zod"
import { createApp } from "../../app.js"
import {
  cookieHeader,
  sendSignInCode,
  signInWithCode,
} from "../../auth.fixtures.js"
import * as schema from "../../db/schema.js"
import {
  createMigratedTestDb,
  testSessionSecret,
  testWebOrigin,
} from "../../test/harness.js"

export async function createProposalClient() {
  const external = process.env.MCP_REPLAY_DATABASE_URL
  const pool = external
    ? new Pool({ connectionString: external, max: 4 })
    : undefined
  const memory = pool ? undefined : await createMigratedTestDb()
  const db = pool ? drizzle(pool, { schema }) : memory!.db
  let callback: URL | undefined
  let loseApproval = false
  const server = serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: async (request) => {
      const url = new URL(request.url)
      if (url.pathname === "/callback") {
        callback = url
        return new Response("Connected")
      }
      const response = await app.fetch(request)
      if (
        loseApproval &&
        url.pathname === "/api/commands/actions.approve" &&
        response.ok
      ) {
        loseApproval = false
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error("Approval response lost after commit"))
            },
          }),
          { status: response.status, headers: response.headers }
        )
      }
      return response
    },
  })
  await new Promise<void>((resolve) => server.once("listening", resolve))
  const address = server.address()
  if (!address || typeof address === "string")
    throw new Error("Missing server port")
  const origin = `http://127.0.0.1:${address.port}`
  const app: ReturnType<typeof createApp> = createApp({
    db,
    authUrl: origin,
    sessionSecret: testSessionSecret,
    webOrigins: [testWebOrigin],
    rateLimitEnabled: false,
    sendCodeLimitEnabled: false,
    logAuthMail: true,
  })
  const post = (path: string, body: unknown, cookie = "") =>
    fetch(`${origin}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: testWebOrigin,
        Cookie: cookie,
      },
      body: JSON.stringify(body),
      redirect: "manual",
    })
  const email = `m5-${randomUUID()}@example.com`
  const signIn = async () => {
    const { code } = await sendSignInCode(app, email)
    if (!code) throw new Error("Missing local sign-in code")
    return cookieHeader(await signInWithCode(app, email, code))
  }
  const close = async () => {
    if ("closeAllConnections" in server) server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
    await pool?.end()
    await memory?.client.close()
  }
  try {
    const scope = "connection.status job.read job.write offline_access"
    const audience = new URL("/mcp", origin)
    const resource = await discoverOAuthProtectedResourceMetadata(audience)
    const issuer = resource.authorization_servers?.[0]
    if (!issuer) throw new Error("Missing authorization server")
    const metadata = await discoverAuthorizationServerMetadata(issuer)
    const redirectUri = `${origin}/callback`
    const registered = await post("/api/auth/oauth2/register", {
      client_name: "M5 approval replay",
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      application_type: "native",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope,
    })
    const client = z
      .object({ client_id: z.string(), redirect_uris: z.array(z.string()) })
      .parse(await registered.json())
    const { authorizationUrl, codeVerifier } = await startAuthorization(
      issuer,
      {
        metadata,
        clientInformation: client,
        redirectUrl: redirectUri,
        scope,
        state: randomUUID(),
        resource: audience,
      }
    )
    const authorize = await new Promise<Response>((resolve, reject) => {
      get(
        authorizationUrl,
        { headers: { Accept: "text/html" } },
        (response) => {
          let body = ""
          response.on("data", (chunk) => {
            body += String(chunk)
          })
          response.on("end", () =>
            resolve(
              new Response(body, {
                status: response.statusCode,
                headers: response.headers.location
                  ? { location: response.headers.location }
                  : {},
              })
            )
          )
        }
      ).on("error", reject)
    })
    if (authorize.status !== 302)
      throw new Error(
        `Authorization failed: ${authorize.status} ${await authorize.text()}`
      )
    const loginUrl = new URL(
      z.string().parse(authorize.headers.get("location"))
    )
    const consentCookie = await signIn()
    const continued = await post(
      "/api/auth/oauth2/continue",
      { oauth_query: loginUrl.search.slice(1), postLogin: true },
      consentCookie
    )
    const consentUrl = new URL(
      z.object({ url: z.string() }).parse(await continued.json()).url
    )
    const consent = await post(
      "/api/auth/oauth2/consent",
      { accept: true, oauth_query: consentUrl.search.slice(1) },
      consentCookie
    )
    await fetch(z.object({ url: z.string() }).parse(await consent.json()).url)
    if (!callback) throw new Error("Missing OAuth callback")
    const tokens = await exchangeAuthorization(issuer, {
      metadata,
      clientInformation: client,
      authorizationCode: z.string().parse(callback.searchParams.get("code")),
      iss: z.string().parse(callback.searchParams.get("iss")),
      codeVerifier,
      redirectUri,
      resource: audience,
    })
    const cookie = await signIn()
    const session = async (value: string) =>
      z
        .object({
          user: z.object({ id: z.string() }),
          session: z.object({ id: z.string() }),
        })
        .parse(
          await (
            await fetch(`${origin}/api/session`, { headers: { Cookie: value } })
          ).json()
        )
    const owner = await session(cookie)
    const consentSession = await session(consentCookie)
    const sdk = new Client({ name: "M5 official client", version: "1.0.0" })
    await sdk.connect(
      new StreamableHTTPClientTransport(audience, {
        requestInit: {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        },
      })
    )
    return {
      db,
      sdk,
      origin,
      owner,
      consentSession,
      backend: external
        ? "external Postgres, existing schema"
        : "migrated PGlite",
      command: (name: string, input: unknown, key = randomUUID()) =>
        post(`/api/commands/${name}`, { input, idempotencyKey: key }, cookie),
      loseNextApprovalResponse() {
        loseApproval = true
      },
      async close() {
        await sdk.close()
        await close()
      },
    }
  } catch (error) {
    await close()
    throw error
  }
}
