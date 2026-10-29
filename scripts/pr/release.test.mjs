import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { format, readStatus, release, runCli } from "./release.mjs"

const commit = "5201a8823b0fc9df52cc319512177b254b446efd"
const later = "86237ebf0000000000000000000000000000000a"
const unrelated = "1111111111111111111111111111111111111111"
const code = ["apps/api/src/a.ts", "apps/web/src/b.tsx"]

const status = (context, state, description) => ({
  context,
  state,
  description,
})
const pending = (c) => status(c, "pending", "Railway is deploying the service")
const built = (c, host) => status(c, "success", `Success - ${host}`)
const skipped = (c) =>
  status(c, "success", "No deployment needed - watched paths not modified")
const failed = (c) => status(c, "failure", "Deployment failed")

const api = "opencv - api"
const web = "opencv - web"
const deepOk = { status: 200, body: '{"ok":true}' }

// `urls` maps a URL to a response, a thunk of the clock, or an Error to throw.
function boundary({
  files = code,
  statuses = [],
  urls = {},
  descendants = [],
} = {}) {
  let now = 0
  const calls = []
  const reads = []
  const io = {
    changedFiles: () => files,
    statuses: () => {
      reads.push(now)
      return typeof statuses === "function" ? statuses(now) : statuses
    },
    async fetch(url) {
      calls.push(url)
      const answer = urls[url]
      const value = typeof answer === "function" ? answer(now) : answer
      if (value instanceof Error) throw value
      if (!value) throw new Error("no route")
      return value
    },
    isAncestor: (ancestor, descendant) =>
      ancestor === commit && descendants.includes(descendant),
    now: () => now,
    async sleep(ms) {
      now += ms
    },
  }
  return { io, calls, reads }
}

const sha = (value) => ({
  status: 200,
  body: JSON.stringify({ ok: true, sha: value }),
})
const healthy = {
  "https://api.opencv.me/health": sha(commit),
  "https://api.opencv.me/health/deep": deepOk,
  "https://opencv.me/version.txt": { status: 200, body: `${commit}\n` },
}
const outcomes = (r) =>
  Object.fromEntries(r.services.map((s) => [s.service, s.outcome]))

test("readStatus classifies each description Railway posts", () => {
  assert.equal(readStatus(pending(api)), "pending")
  assert.equal(readStatus(built(api, "api.opencv.me")), "deployed")
  assert.equal(readStatus(built(web, "app.opencv.me")), "deployed")
  assert.equal(readStatus(skipped(api)), "skipped")
  assert.equal(readStatus(failed(api)), "failed")
  assert.equal(readStatus(status(api, "error", "")), "failed")
})

test("both rebuilt and serving the merge sha is LIVE", async () => {
  const { io } = boundary({
    statuses: [built(api, "api.opencv.me"), built(web, "app.opencv.me")],
    urls: healthy,
  })
  const r = await release({ commit }, io)
  assert.equal(r.outcome, "LIVE")
  assert.deepEqual(outcomes(r), { api: "LIVE", web: "LIVE" })
})

test("the newest status per context wins over older pending ones", async () => {
  const { io } = boundary({
    statuses: [
      built(api, "api.opencv.me"),
      built(web, "app.opencv.me"),
      pending(api),
      pending(web),
    ],
    urls: healthy,
  })
  assert.equal((await release({ commit }, io)).outcome, "LIVE")
})

test("a failure status is BROKEN, replayed like 9ddf7a01", async () => {
  const { io, calls } = boundary({
    statuses: [failed(api), pending(api), skipped(web)],
    files: ["apps/api/src/auth.ts"],
  })
  const r = await release({ commit }, io)
  assert.equal(r.outcome, "BROKEN")
  assert.deepEqual(outcomes(r), { api: "BROKEN", web: "LIVE" })
  assert.deepEqual(calls, [], "a failed build needs no public check")
  assert.match(format(r), /api\s+BROKEN\s+Railway said "Deployment failed"/)
})

test("a pending status is PENDING", async () => {
  const { io } = boundary({ statuses: [pending(api), pending(web)] })
  assert.equal((await release({ commit }, io)).outcome, "PENDING")
})

test("no status yet is PENDING", async () => {
  const { io } = boundary({ statuses: [] })
  assert.equal((await release({ commit }, io)).outcome, "PENDING")
})

test("a docs-only commit with both skipped is LIVE and reads no public sha", async () => {
  const { io, calls } = boundary({
    files: ["docs/deploy.md"],
    statuses: [skipped(api), skipped(web)],
  })
  const r = await release({ commit }, io)
  assert.equal(r.outcome, "LIVE")
  assert.deepEqual(calls, [])
  assert.ok(r.services.every((s) => !s.affected))
})

test("only the affected service needs a rebuild", async () => {
  const { io } = boundary({
    files: ["apps/web/src/b.tsx"],
    statuses: [skipped(api), built(web, "app.opencv.me")],
    urls: healthy,
  })
  const r = await release({ commit }, io)
  assert.deepEqual(outcomes(r), { api: "LIVE", web: "LIVE" })
  assert.deepEqual(
    r.services.map((s) => s.affected),
    [false, true]
  )
})

test("an affected service Railway skipped is RELEASE_BLOCKED", async () => {
  const { io } = boundary({
    files: ["package.json"],
    statuses: [skipped(api), skipped(web)],
  })
  const r = await release({ commit }, io)
  assert.equal(r.outcome, "RELEASE_BLOCKED")
  assert.deepEqual(outcomes(r), { api: "RELEASE_BLOCKED", web: "LIVE" })
})

test("a public sha that differs is PENDING until the wait ends, then RELEASE_BLOCKED", async () => {
  const stale = {
    ...healthy,
    "https://opencv.me/version.txt": { status: 200, body: `${unrelated}\n` },
  }
  const statuses = [built(api, "api.opencv.me"), built(web, "app.opencv.me")]
  assert.equal(
    (await release({ commit }, boundary({ statuses, urls: stale }).io)).outcome,
    "RELEASE_BLOCKED"
  )
  const { io, reads } = boundary({ statuses, urls: stale })
  const r = await release({ commit, wait: 60 }, io)
  assert.equal(r.outcome, "RELEASE_BLOCKED")
  assert.deepEqual(outcomes(r), { api: "LIVE", web: "RELEASE_BLOCKED" })
  assert.ok(reads.length > 2 && reads.at(-1) === 60_000, `reads at ${reads}`)
  assert.match(
    r.services[1].detail,
    new RegExp(`serves ${unrelated.slice(0, 7)}, not ${commit.slice(0, 7)}`)
  )
})

test("a later commit that contains the merge counts as serving it", async () => {
  const { io } = boundary({
    statuses: [built(api, "api.opencv.me"), built(web, "app.opencv.me")],
    urls: { ...healthy, "https://api.opencv.me/health": sha(later) },
    descendants: [later],
  })
  const r = await release({ commit }, io)
  assert.equal(r.outcome, "LIVE")
  assert.match(r.services[0].detail, /serves 86237eb, which contains it/)
})

test("an unrelated newer sha is not accepted", async () => {
  const { io } = boundary({
    statuses: [built(api, "api.opencv.me"), built(web, "app.opencv.me")],
    urls: { ...healthy, "https://api.opencv.me/health": sha(later) },
  })
  assert.deepEqual(outcomes(await release({ commit }, io)), {
    api: "RELEASE_BLOCKED",
    web: "LIVE",
  })
})

test("a 503 from /health/deep on a live api is BROKEN", async () => {
  const { io } = boundary({
    statuses: [built(api, "api.opencv.me"), built(web, "app.opencv.me")],
    urls: {
      ...healthy,
      "https://api.opencv.me/health/deep": {
        status: 503,
        body: '{"ok":false,"mail":false}',
      },
    },
  })
  const r = await release({ commit }, io)
  assert.equal(r.outcome, "BROKEN")
  assert.match(r.services[0].detail, /answered 503: .*"mail":false/)
})

test("an unreadable public sha waits, then blocks", async () => {
  const urls = {
    ...healthy,
    "https://opencv.me/version.txt": new Error("timeout"),
  }
  const statuses = [built(api, "api.opencv.me"), built(web, "app.opencv.me")]
  const r = await release({ commit, wait: 10 }, boundary({ statuses, urls }).io)
  assert.equal(r.outcome, "RELEASE_BLOCKED")
  assert.match(r.services[1].detail, /unreadable: timeout/)
})

test("--wait rereads until Railway finishes and the public sha follows", async () => {
  const { io, reads } = boundary({
    statuses: (now) =>
      now < 20_000
        ? [pending(api), pending(web)]
        : [built(api, "api.opencv.me"), built(web, "app.opencv.me")],
    urls: {
      ...healthy,
      "https://opencv.me/version.txt": (now) => ({
        status: 200,
        body: now < 40_000 ? `${unrelated}\n` : `${commit}\n`,
      }),
    },
  })
  const r = await release({ commit, wait: 600 }, io)
  assert.equal(r.outcome, "LIVE")
  assert.ok(reads.length >= 4 && reads.at(-1) < 600_000)
})

test("--wait gives up PENDING at the deadline", async () => {
  const { io, reads } = boundary({ statuses: [pending(api), pending(web)] })
  const r = await release({ commit, wait: 30 }, io)
  assert.equal(r.outcome, "PENDING")
  assert.equal(reads.at(-1), 30_000)
})

test("BROKEN wins over PENDING and PENDING over LIVE", async () => {
  const mixed = (a, w) => boundary({ statuses: [a, w], urls: healthy }).io
  assert.equal(
    (await release({ commit }, mixed(failed(api), pending(web)))).outcome,
    "BROKEN"
  )
  assert.equal(
    (
      await release(
        { commit },
        mixed(pending(api), built(web, "app.opencv.me"))
      )
    ).outcome,
    "PENDING"
  )
})

test("the CLI exits by outcome and writes a valid result file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pr-release-"))
  process.env.PR_RESULT_DIR = dir
  process.env.PR_RESULT_REPO = "opencv"
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim()
  const lines = []
  const log = console.log
  console.log = (line) => lines.push(line)
  let code
  try {
    const { io } = boundary({ statuses: [failed(api), skipped(web)] })
    code = await runCli([head], io)
  } finally {
    console.log = log
  }
  assert.equal(code, 1)
  const file = join(dir, `opencv-release-${head.slice(0, 7)}.json`)
  assert.equal(lines.at(-1), `RESULT_JSON: ${file}`)
  assert.equal(JSON.parse(readFileSync(file, "utf8")).status, "fail")
  const checker = new URL("../lib/result-check.mjs", import.meta.url).pathname
  execFileSync("node", [checker, file, "cause=deploy", "script=release"])
})
