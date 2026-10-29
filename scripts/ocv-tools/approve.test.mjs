import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"
import { approveComment } from "./approve.mjs"
import { runCli } from "./cli.mjs"
import { approvalValid } from "./report.mjs"
import { ctxFor, fakePorts, issue } from "./ports/fake.mjs"

const posted = (ports) => ports.effects.find((e) => e.op === "comment")

function run(over = {}, extra = {}) {
  const ports = fakePorts({
    owner: extra.owner ?? "owner",
    login: extra.login ?? "owner",
    ownerType: extra.ownerType,
    admins: extra.admins,
    approversError: extra.approversError,
    env: extra.env,
    files: extra.files,
    issues: [
      issue(90, {
        labels: ["risk:high"],
        comments: [],
        ...over,
      }),
    ],
  })
  return { ports, ctx: ctxFor(ports, extra) }
}

test("approve posts /approve and names the agent that relayed it", () => {
  const { ports, ctx } = run({}, { env: { OCV_TOOLS_AGENT: "agent-7" } })
  const { code, text } = runCli(["approve", "#90"], ctx)
  assert.equal(code, 0, text)
  assert.match(text, /Posted \/approve on #90/)
  assert.match(
    text,
    /The agent must only run this after the owner said "approved" in this chat\./
  )
  assert.match(text, /\nNext: scripts\/ocv-tools\.mjs take 90/)
  assert.equal(
    posted(ports).body,
    "/approve\nRelayed by agent agent-7 from the owner in chat."
  )
  assert.equal(
    approvalValid({
      approvers: ["owner"],
      createdAt: "2026-10-01T00:00:00Z",
      lastEditedAt: "2026-10-29T11:00:00Z",
      comments: [
        {
          author: { login: "owner" },
          body: approveComment("agent-7"),
          createdAt: "2026-10-29T12:00:00Z",
        },
      ],
    }),
    true
  )
})

test("approve reads the agent id from the worktree when the env is unset", () => {
  const gitDir = "/tmp/opencv/.git/worktrees/90-keep"
  const { ports, ctx } = run(
    {},
    { files: { [join(gitDir, "ocv-tools-agent")]: "agent-file\n" } }
  )
  const { code, text } = runCli(["approve", "90"], ctx)
  assert.equal(code, 0, text)
  assert.equal(
    posted(ports).body,
    "/approve\nRelayed by agent agent-file from the owner in chat."
  )
})

test("approve refuses anything that is not an open risk:high issue", () => {
  const normal = run({ labels: ["risk:normal"] })
  const normalResult = runCli(["approve", "90"], normal.ctx)
  assert.equal(normalResult.code, 2)
  assert.match(normalResult.text, /REFUSED NOT_HIGH_RISK/)
  assert.match(normalResult.text, /No approval is needed/)
  assert.match(normalResult.text, /\nFix: /)
  const low = runCli(["approve", "90"], run({ labels: ["risk:low"] }).ctx)
  assert.match(low.text, /NOT_HIGH_RISK/)
  assert.match(low.text, /no approval is needed/)
  const unset = runCli(
    ["approve", "90"],
    run({ labels: [], body: "no risk section" }).ctx
  )
  assert.match(unset.text, /NOT_HIGH_RISK/)
  const closed = runCli(["approve", "90"], run({ state: "CLOSED" }).ctx)
  assert.equal(closed.code, 2)
  assert.match(closed.text, /REFUSED CLOSED/)
  const closedLow = runCli(
    ["approve", "90"],
    run({ state: "CLOSED", labels: ["risk:low"] }).ctx
  )
  assert.match(closedLow.text, /REFUSED CLOSED/)
  const missingPorts = fakePorts({ issues: [issue(90)], login: "owner" })
  const missing = runCli(["approve", "91"], ctxFor(missingPorts))
  assert.equal(missing.code, 2)
  assert.match(missing.text, /REFUSED NOT_AN_ISSUE/)
  assert.equal(posted(normal.ports), undefined)
  assert.equal(posted(missingPorts), undefined)
  for (const result of [normalResult, low, closed, missing])
    assert.ok(!result.text.includes("issue comment"))
})

test("a valid /approve after the last edit is left as it is", () => {
  const { ports, ctx } = run(
    {
      comments: [
        {
          author: { login: "owner" },
          body: "/approve\nRelayed by agent old from the owner in chat.",
          createdAt: "2026-10-29T11:00:00Z",
        },
      ],
    },
    { env: { OCV_TOOLS_AGENT: "agent-7" } }
  )
  const { code, text } = runCli(["approve", "90"], ctx)
  assert.equal(code, 0, text)
  assert.match(text, /already has a valid \/approve/)
  assert.match(text, /Nothing posted/)
  assert.match(text, /owner said "approved"/)
  assert.equal(posted(ports), undefined)
})

test("an older or foreign /approve does not count, so a new one is posted", () => {
  const stale = run(
    {
      lastEditedAt: "2026-10-29T12:00:00Z",
      comments: [
        {
          author: { login: "owner" },
          body: "/approve",
          createdAt: "2026-10-29T11:00:00Z",
        },
      ],
    },
    { env: { OCV_TOOLS_AGENT: "agent-7" } }
  )
  assert.equal(runCli(["approve", "90"], stale.ctx).code, 0)
  assert.match(posted(stale.ports).body, /Relayed by agent agent-7/)
  const foreign = run(
    {
      comments: [
        {
          author: { login: "someone" },
          body: "/approve",
          createdAt: "2026-10-29T11:00:00Z",
        },
      ],
    },
    { env: { OCV_TOOLS_AGENT: "agent-7" } }
  )
  assert.equal(runCli(["approve", "90"], foreign.ctx).code, 0)
  assert.match(posted(foreign.ports).body, /^\/approve\n/)
})

test("approve refuses a collaborator and does not post", () => {
  const { ports, ctx } = run(
    {},
    { login: "collaborator", env: { OCV_TOOLS_AGENT: "agent-7" } }
  )
  const { code, text } = runCli(["approve", "90"], ctx)
  assert.equal(code, 2, text)
  assert.match(text, /REFUSED NOT_OWNER/)
  assert.match(text, /signed in as collaborator/)
  assert.match(
    text,
    /Fix: run this as an account with admin rights on the project/
  )
  assert.equal(posted(ports), undefined)
})

test("an organization admin can approve, while a non-admin cannot", () => {
  const admin = run(
    {},
    {
      owner: "Rickvu309",
      ownerType: "Organization",
      admins: ["RickVu", "admin-person"],
      login: "ADMIN-PERSON",
    }
  )
  assert.equal(runCli(["approve", "90"], admin.ctx).code, 0)
  assert.match(posted(admin.ports).body, /^\/approve/)

  const member = run(
    {},
    {
      owner: "Rickvu309",
      ownerType: "Organization",
      admins: ["admin-person"],
      login: "ordinary-member",
    }
  )
  const result = runCli(["approve", "90"], member.ctx)
  assert.equal(result.code, 2)
  assert.match(result.text, /REFUSED NOT_OWNER/)
  assert.equal(posted(member.ports), undefined)
})

test("approve fails loudly when the admin collaborators read fails", () => {
  const { ports, ctx } = run({}, { approversError: "permission denied" })
  const result = runCli(["approve", "90"], ctx)
  assert.equal(result.code, 1)
  assert.match(result.text, /permission denied/)
  assert.equal(posted(ports), undefined)
})

test("approve usage", () => {
  const ctx = ctxFor(fakePorts())
  assert.equal(runCli(["approve"], ctx).code, 1)
  assert.equal(runCli(["approve", "0"], ctx).code, 1)
  assert.match(runCli(["approve", "90", "--yes"], ctx).text, /UNKNOWN_FLAG/)
  const { text } = runCli(["help"], ctx)
  assert.match(text, /approve <n>/)
  assert.match(text, /NOT_HIGH_RISK/)
  assert.match(text, /NOT_OWNER/)
  assert.match(text, /admin rights/)
})
