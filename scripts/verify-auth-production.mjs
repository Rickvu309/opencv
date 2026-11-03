#!/usr/bin/env node
import { writeFileSync } from "node:fs"
import { parseArgs } from "node:util"
import { pathToFileURL } from "node:url"
import {
  cli,
  listDeploymentsNewestFirst,
  railwayScope,
} from "./lib/railway-deploy.mjs"

const api = "https://api.opencv.me"
const origin = "https://app.opencv.me"

function requireProof(condition, message) {
  if (!condition) throw new Error(message)
}

async function request(path, { body, cookie } = {}) {
  const response = await fetch(`${api}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: origin,
      "User-Agent": "curl/8.0 opencv-auth-proof",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30_000),
    redirect: "error",
  })
  let bodyValue
  try {
    bodyValue = await response.json()
  } catch {
    throw new Error(
      `Production request ${path} returned invalid JSON (HTTP ${response.status}); response withheld.`
    )
  }
  return {
    status: response.status,
    body: bodyValue,
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(";", 1)[0])
      .join("; "),
  }
}

export async function verifyAuthProduction(
  { commit, email, mailId },
  io = { cli, request }
) {
  requireProof(
    /^[a-f0-9]{40}$/.test(commit ?? ""),
    "Use --commit with the full expected production commit SHA."
  )
  requireProof(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? ""),
    "Use --email with an address you control. This sends and consumes a sign-in code."
  )
  email = email.toLowerCase()
  const deployments = listDeploymentsNewestFirst("api", io)
  const deployed = deployments.find(
    (deployment) => deployment.status === "SUCCESS"
  )
  requireProof(
    deployed?.meta?.commitHash === commit,
    "Production is not running the expected commit. Resolve the Railway deployment before claiming recovery."
  )
  const variables = io.cli("railway", [
    "variable",
    "list",
    ...railwayScope("api"),
    "--json",
  ])
  requireProof(
    ["RESEND_API_KEY", "AUTH_EMAIL_FROM"].every(
      (key) =>
        Object.hasOwn(variables, key) &&
        (variables[key] === null || variables[key]?.trim())
    ),
    "Production mail is not configured. Use the authenticated Resend CLI to provision a domain-scoped sending key and set Railway RESEND_API_KEY and AUTH_EMAIL_FROM."
  )
  const domains = io.cli("resend", ["domains", "list", "--json"])
  requireProof(
    domains.data.some(
      (domain) =>
        domain.name === "opencv.me" &&
        domain.status === "verified" &&
        domain.capabilities?.sending === "enabled"
    ),
    "The authenticated Resend account must have verified sending for opencv.me."
  )
  const health = await io.request("/health")
  requireProof(
    health.status === 200 && health.body.ok === true,
    "Production API health failed."
  )

  if (!mailId) {
    const sent = await io.request("/api/auth/email-otp/send-verification-otp", {
      body: { email, type: "sign-in" },
    })
    requireProof(
      sent.status === 200 && sent.body.success === true,
      "Production rejected the sign-in email request."
    )
    requireProof(
      typeof sent.body.emailId === "string" && sent.body.emailId.length > 0,
      "The sign-in response has no provider message ID. HTTP 200 alone does not prove delivery."
    )
    mailId = sent.body.emailId
  }
  const mail = io.cli("resend", ["emails", "get", mailId, "--json"])
  requireProof(
    mail.to.includes(email) &&
      mail.subject === "Your opencv code" &&
      /@opencv\.me>?$/.test(mail.from),
    "The selected email does not match this sign-in test."
  )
  requireProof(
    ["delivered", "opened", "clicked"].includes(mail.last_event),
    `Resend has not confirmed delivery (email ${mailId}). Check again with --mail-id ${mailId}; do not send another code just to wait.`
  )
  requireProof(
    Date.now() - Date.parse(mail.created_at) < 5 * 60_000,
    "The delivered code has expired. Start a fresh sign-in test."
  )
  const otp = mail.text?.match(/Your opencv code is (\d{6})\./)?.[1]
  requireProof(otp, "The delivered email has no recognizable sign-in code.")
  const signedIn = await io.request("/api/auth/sign-in/email-otp", {
    body: { email, otp },
  })
  requireProof(
    signedIn.status === 200 && signedIn.cookie,
    "The delivered code did not create a signed-in session."
  )
  try {
    const session = await io.request("/api/session", {
      cookie: signedIn.cookie,
    })
    requireProof(
      session.status === 200 &&
        session.body.ok === true &&
        session.body.user?.email === email,
      "The sign-in cookie cannot read the expected account session."
    )
  } finally {
    const signedOut = await io.request("/api/auth/sign-out", {
      body: {},
      cookie: signedIn.cookie,
    })
    requireProof(
      signedOut.status === 200,
      "The verification session could not be signed out."
    )
  }
  const endedSession = await io.request("/api/session", {
    cookie: signedIn.cookie,
  })
  requireProof(
    endedSession.status === 401,
    "The verification session is still usable after sign-out."
  )
  return {
    verifiedAt: new Date().toISOString(),
    commit,
    deploymentId: deployed.id,
    emailId: mailId,
    delivery: "delivered",
    session: "verified and signed out",
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const { values } = parseArgs({
      options: {
        commit: { type: "string" },
        email: { type: "string" },
        "mail-id": { type: "string" },
        evidence: { type: "string" },
      },
    })
    const proof = await verifyAuthProduction({
      commit: values.commit,
      email: values.email,
      mailId: values["mail-id"],
    })
    const output = `${JSON.stringify(proof, null, 2)}\n`
    if (values.evidence)
      writeFileSync(values.evidence, output, { mode: 0o600, flag: "wx" })
    process.stdout.write(output)
  } catch (error) {
    console.error(`FAIL production auth: ${error.message}`)
    process.exitCode = 1
  }
}
