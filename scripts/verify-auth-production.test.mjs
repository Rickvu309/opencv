import assert from "node:assert/strict"
import test from "node:test"
import { verifyAuthProduction } from "./verify-auth-production.mjs"

const commit = "4fd1e191cbbc7a44d7f52ace1cf00e0bf4be00a5"
const options = { commit, email: "owner@example.com" }

function boundary(overrides = {}) {
  const calls = []
  const mail = {
    id: "test-email",
    to: [options.email],
    from: "opencv <no-reply@opencv.me>",
    subject: "Your opencv code",
    created_at: new Date().toISOString(),
    last_event: "delivered",
    text: "Your opencv code is 123456.",
  }
  const io = {
    cli(command, args) {
      calls.push(`${command} ${args.slice(0, 2).join(" ")}`)
      if (args[0] === "deployment")
        return [
          {
            id: "live-deployment",
            status: "SUCCESS",
            meta: { commitHash: overrides.deployedCommit ?? commit },
          },
        ]
      if (args[0] === "variable")
        return (
          overrides.variables ?? {
            RESEND_API_KEY: "secret-test-key",
            AUTH_EMAIL_FROM: mail.from,
          }
        )
      if (args[0] === "domains")
        return {
          data: [
            {
              name: "opencv.me",
              status: "verified",
              capabilities: { sending: "enabled" },
            },
          ],
        }
      if (args[1] === "list") return { data: overrides.emails ?? [mail] }
      return { ...mail, ...overrides.mail }
    },
    async request(path) {
      calls.push(path)
      if (path === "/health") return { status: 200, body: { ok: true } }
      if (path.endsWith("send-verification-otp"))
        return { status: 200, body: { success: true } }
      if (path.endsWith("sign-in/email-otp"))
        return { status: 200, cookie: "secret-test-cookie", body: {} }
      if (path === "/api/session")
        return (
          overrides.session ?? {
            status: 200,
            body: { ok: true, user: { email: options.email } },
          }
        )
      if (path.endsWith("sign-out"))
        return { status: 200, body: { success: true } }
      assert.fail(`Unexpected request ${path}`)
    },
  }
  return { io, calls }
}

test("rejects the incident's successful old image before sending mail", async () => {
  const { io, calls } = boundary({
    deployedCommit: "4065473a16c52234c1dc03bd17b4389c9cb6d2c5",
  })
  await assert.rejects(
    verifyAuthProduction(options, io),
    /not running the expected commit/
  )
  assert.deepEqual(calls, ["railway deployment list"])
})

test("discovers missing mail configuration and names CLI provisioning instead of asking for a key", async () => {
  const { io, calls } = boundary({ variables: {} })
  await assert.rejects(
    verifyAuthProduction(options, io),
    /authenticated Resend CLI.*RESEND_API_KEY and AUTH_EMAIL_FROM/
  )
  assert.equal(
    calls.some((call) => call.startsWith("/api/")),
    false
  )
})

test("HTTP 200 without a provider email is a failure", async () => {
  const { io } = boundary({ emails: [] })
  await assert.rejects(
    verifyAuthProduction(options, io),
    /HTTP 200 alone does not prove delivery/
  )
})

test("queued and bounced mail never count as delivered", async () => {
  for (const last_event of ["queued", "bounced"]) {
    const { io, calls } = boundary({ mail: { last_event } })
    await assert.rejects(
      verifyAuthProduction(options, io),
      /not confirmed delivery.*--mail-id test-email/
    )
    assert.equal(calls.includes("/api/auth/sign-in/email-otp"), false)
  }
})

test("delivered mail with an unusable session fails and still signs out", async () => {
  const { io, calls } = boundary({ session: { status: 401, body: {} } })
  await assert.rejects(
    verifyAuthProduction(options, io),
    /cannot read the expected account session/
  )
  assert.equal(calls.at(-1), "/api/auth/sign-out")
})

test("resuming a pending email checks it without sending another code", async () => {
  const { io, calls } = boundary()
  await verifyAuthProduction({ ...options, mailId: "test-email" }, io)
  assert.equal(
    calls.includes("/api/auth/email-otp/send-verification-otp"),
    false
  )
})

test("success proves deployment, delivery and session without retaining secrets", async () => {
  const { io, calls } = boundary()
  const proof = await verifyAuthProduction(options, io)
  assert.equal(proof.commit, commit)
  assert.equal(proof.emailId, "test-email")
  assert.equal(proof.delivery, "delivered")
  assert.equal(proof.session, "verified and signed out")
  assert.equal(calls.at(-1), "/api/auth/sign-out")
  assert.doesNotMatch(JSON.stringify(proof), /123456|secret-test|owner@example/)
})
