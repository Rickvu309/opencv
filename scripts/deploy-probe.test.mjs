import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  CONFIRM_GAP_MS,
  DEPLOY_WAIT_MS,
  bounded,
  confirmed,
  deployedShas,
  issueActions,
  latestMigration,
  main,
  probe,
  report,
  smokeHeading,
} from "./deploy-probe.mjs"
import { liveHttp, readOnlyRequest } from "./deploy-probe-live.mjs"
import { wordParagraphs } from "./deploy-probe-word.mjs"

const fixture = (name) => new URL(`./fixtures/probe/${name}`, import.meta.url)
const recorded = JSON.parse(readFileSync(fixture("local-app.json"), "utf8"))
const smokeCv = readFileSync(fixture("smoke-cv.docx"))
const exported = readFileSync(fixture("exported.docx"))
const sha = "4f2a91c0e1d2c3b4a5968778695a4b3c2d1e0f9a"
const oldSha = "0b1c2d3e4f5a69788796a5b4c3d2e1f0a9b8c7d6"
const schema = recorded.deep.schemaVersion
const docId = recorded.list.data[0].id
const session = "__Secure-better-auth.session_token=s3cr3t-token.signature"
const target = {
  api: "https://api.example.test",
  web: "https://app.example.test",
  docId,
  session,
}
const heading = smokeHeading()
const WORD =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

function production(shape = {}) {
  const calls = []
  let time = 0
  let healthAnswers = 0
  const authed = (options) => options?.session === session
  const http = {
    async json(url, options = {}) {
      calls.push(`${options.method ?? "GET"} ${new URL(url).pathname}`)
      const path = new URL(url).pathname
      if (path === "/health") {
        healthAnswers += 1
        const arrived = healthAnswers > (shape.shaAfterPolls ?? 0)
        return {
          status: 200,
          body: {
            ...recorded.health,
            sha: shape.neverDeploys || !arrived ? oldSha : sha,
            ...shape.health,
          },
        }
      }
      if (path === "/health/deep")
        return {
          status: shape.deep?.db === false ? 503 : 200,
          body: { ...recorded.deep, sha, ...shape.deep },
        }
      if (path === "/api/session")
        return shape.sessionExpired || !authed(options)
          ? { status: 401, body: recorded.refusedSession }
          : { status: shape.sessionStatus ?? 200, body: { ok: true } }
      if (path === "/api/reads/paper.list")
        return { status: 200, body: shape.list ?? recorded.list }
      if (path === "/api/reads/paper.read")
        return shape.readMissing
          ? { status: 404, body: recorded.missingDocument }
          : { status: 200, body: recorded.read }
      throw new Error(`unexpected ${path}`)
    },
    async text(url) {
      calls.push(`GET ${new URL(url).pathname}`)
      return { status: 200, text: `${shape.webSha ?? sha}\n` }
    },
    async bytes(url) {
      calls.push(`GET ${new URL(url).pathname}`)
      return shape.word ?? { status: 200, type: WORD, bytes: exported }
    },
  }
  const browser = {
    async visibleText(url, options) {
      calls.push(`BROWSER ${new URL(url).pathname}`)
      assert.equal(options.session, session)
      return {
        text: shape.pageText ?? `Paper\n${heading}\nExperience\nDownload Word`,
      }
    },
  }
  const clock = {
    now: () => time,
    pause: async (ms) => {
      calls.push(`PAUSE ${ms}`)
      time += ms
    },
  }
  return { ports: { http, browser, clock }, calls, elapsed: () => time }
}

const run = (shape, overrides = {}) => {
  const fake = production(shape)
  return probe(
    fake.ports,
    sha,
    schema,
    { ...target, ...overrides },
    { heading }
  ).then((outcome) => ({ outcome, ...fake }))
}

test("a production shaped like main passes and every request is a read", async () => {
  const { outcome, calls } = await run()
  assert.deepEqual(outcome, { kind: "pass", sha })
  assert.ok(
    calls.every((call) => /^(GET|BROWSER|POST \/api\/reads\/)/.test(call)),
    calls.join(", ")
  )
  assert.deepEqual(
    calls.filter((call) => !call.startsWith("PAUSE")),
    [
      "GET /health",
      "GET /health/deep",
      "GET /version.txt",
      "GET /api/session",
      "POST /api/reads/paper.list",
      "POST /api/reads/paper.read",
      "BROWSER /paper/" + docId,
      `GET /api/paper/packages/${docId}/export`,
    ]
  )
})

test("a production shaped like the incident is product red at the open step", async () => {
  const { outcome } = await run({
    pageText: "Paper\nDocument not found.\nBack to Paper",
  })
  assert.equal(outcome.kind, "product-red")
  assert.deepEqual(outcome.failures, [
    `open: expected the heading "${heading}" and no "Document not found.", saw Document not found.`,
  ])
})

test("the sha never arrives: red after ten minutes of polling, not sooner and not forever", async () => {
  const { outcome, elapsed, calls } = await run({ neverDeploys: true })
  assert.equal(outcome.kind, "product-red")
  assert.match(
    outcome.failures[0],
    new RegExp(`^health: expected sha ${sha} within 10 min, saw sha ${oldSha}$`)
  )
  assert.ok(
    elapsed() <= DEPLOY_WAIT_MS && elapsed() >= DEPLOY_WAIT_MS - 15_000,
    String(elapsed())
  )
  assert.equal(calls.filter((call) => call === "GET /api/session").length, 0)
})

test("the sha arriving after a few polls passes", async () => {
  const { outcome, elapsed } = await run({ shaAfterPolls: 3 })
  assert.deepEqual(outcome, { kind: "pass", sha })
  assert.equal(elapsed(), 45_000)
})

const redCases = [
  [
    "deep health reports the database down",
    { deep: { db: false } },
    /^deep health: expected db true, saw HTTP 503, db false$/,
  ],
  [
    "schema behind the tree",
    { deep: { schemaVersion: "0024_paper_package_pages" } },
    new RegExp(
      `^deep health: expected schemaVersion ${schema}, saw schemaVersion 0024_paper_package_pages$`
    ),
  ],
  [
    "web version stale",
    { webSha: oldSha },
    new RegExp(`^web version: expected ${sha}, saw HTTP 200 ${oldSha}$`),
  ],
  [
    "PDF reading off",
    { health: { pdfReading: false } },
    /^health: expected pdfReading true, saw pdfReading false$/,
  ],
  [
    "the smoke CV missing from the library",
    { list: { ok: true, data: [] } },
    /^library: expected the smoke CV in the list, saw 0 CVs, none with the smoke CV id$/,
  ],
  [
    "the smoke CV listed but not as a Word page",
    {
      list: {
        ok: true,
        data: [{ ...recorded.list.data[0], format: "blocks" }],
      },
    },
    /^library: expected the smoke CV listed as a Word page, saw format blocks$/,
  ],
  [
    "the page read says Document not found",
    { readMissing: true },
    /^page read: expected HTTP 200 with a revision, saw HTTP 404 Document not found$/,
  ],
  [
    "the page loads but without the heading",
    { pageText: "Paper\nLoading…" },
    /^open: expected the heading .* saw a page without the heading \(14 characters of text\)$/,
  ],
  [
    "the Word download fails to parse",
    {
      word: {
        status: 200,
        type: WORD,
        bytes: new TextEncoder().encode("<html>oops</html>"),
      },
    },
    /^Word download: expected a Word file that parses, saw not a zip file$/,
  ],
  [
    "the Word download is an error page",
    {
      word: { status: 500, type: "application/json", bytes: new Uint8Array() },
    },
    /^Word download: expected HTTP 200 .*, saw HTTP 500 application\/json$/,
  ],
  [
    "the Word download lacks the heading",
    { word: { status: 200, type: WORD, bytes: wordWithout() } },
    /^Word download: expected the heading .* in the file, saw 1 paragraphs without it$/,
  ],
  [
    "the session read fails on the server",
    { sessionStatus: 500 },
    /^session: expected HTTP 200, saw HTTP 500$/,
  ],
]

function wordWithout() {
  return storedZip(
    "word/document.xml",
    "<w:document><w:body><w:p><w:r><w:t>Someone else</w:t></w:r></w:p></w:body></w:document>"
  )
}

function storedZip(name, content) {
  const data = Buffer.from(content)
  const file = Buffer.from(name)
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt32LE(data.length, 18)
  local.writeUInt32LE(data.length, 22)
  local.writeUInt16LE(file.length, 26)
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt32LE(data.length, 20)
  central.writeUInt32LE(data.length, 24)
  central.writeUInt16LE(file.length, 28)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(46 + file.length, 12)
  end.writeUInt32LE(30 + file.length + data.length, 16)
  return Buffer.concat([local, file, data, central, file, end])
}

for (const [name, shape, expected] of redCases) {
  test(`product red: ${name}`, async () => {
    const { outcome } = await run(shape)
    assert.equal(outcome.kind, "product-red")
    assert.equal(outcome.sha, sha)
    assert.equal(outcome.failures.length, 1, outcome.failures.join(" | "))
    assert.match(outcome.failures[0], expected)
  })
}

test("an expired session is probe-broken, never product red, and never prints the session", async () => {
  const { outcome, calls } = await run({ sessionExpired: true })
  assert.equal(outcome.kind, "probe-broken")
  assert.match(outcome.reason, /smoke session was refused \(HTTP 401\)/)
  assert.ok(!JSON.stringify(outcome).includes("s3cr3t"))
  assert.ok(!calls.includes("POST /api/reads/paper.list"))
})

test("a missing or malformed session or document id is probe-broken before any request", async () => {
  for (const overrides of [
    { session: "" },
    { session: "just-a-token" },
    { docId: "" },
    { docId: "../../etc" },
  ]) {
    const { outcome, calls } = await run({}, overrides)
    assert.equal(outcome.kind, "probe-broken", JSON.stringify(overrides))
    assert.deepEqual(calls, [])
  }
})

test("failure output is bounded and withholds the session and email addresses", async () => {
  const { outcome } = await run({
    pageText: `${session} probe@example.com Document not found. ${"x".repeat(5000)}`,
  })
  const [failure] = outcome.failures
  assert.ok(!failure.includes("s3cr3t") && !failure.includes("probe@"), failure)
  const echoed = bounded(
    `refused ${session} for probe@example.com ${"y".repeat(5000)}`,
    [session]
  )
  assert.ok(
    !echoed.includes("s3cr3t") && !echoed.includes("probe@example.com"),
    echoed
  )
  assert.match(echoed, /^refused \[withheld\] for \[email\] y+…$/)
  assert.ok(echoed.length <= 161, String(echoed.length))
  assert.equal(bounded("a\n\n b", []), "a b")
})

test("two reds 60 s apart open production-red; one red then a pass opens nothing", async () => {
  const incident = production({ pageText: "Document not found." })
  const twice = await confirmed(incident.ports, () =>
    probe(incident.ports, sha, schema, target, { heading })
  )
  assert.equal(twice.runs.length, 2)
  assert.ok(incident.calls.includes(`PAUSE ${CONFIRM_GAP_MS}`))
  const actions = issueActions(twice, [])
  assert.deepEqual(
    actions.map((action) => [action.do, action.label]),
    [["open", "production-red"]]
  )
  assert.match(actions[0].note, /twice, 60 s apart/)
  assert.deepEqual(issueActions(twice, ["production-red"]), [])

  let first = true
  const flaky = production()
  const recovered = await confirmed(flaky.ports, async () => {
    if (first) {
      first = false
      return { kind: "product-red", sha, failures: ["open: expected x, saw y"] }
    }
    return probe(flaky.ports, sha, schema, target, { heading })
  })
  assert.equal(recovered.outcome.kind, "pass")
  assert.deepEqual(issueActions(recovered, []), [])
})

test("a later pass closes production-red and probe-broken", () => {
  const actions = issueActions(
    { outcome: { kind: "pass", sha }, runs: [{ kind: "pass", sha }] },
    ["production-red", "probe-broken"]
  )
  assert.deepEqual(
    actions.map((action) => [action.do, action.label]),
    [
      ["close", "production-red"],
      ["close", "probe-broken"],
    ]
  )
})

test("probe-broken never opens production-red and opens probe-broken once", () => {
  const broken = {
    kind: "probe-broken",
    reason: "the smoke session was refused",
  }
  const result = { outcome: broken, runs: [broken] }
  assert.deepEqual(
    issueActions(result, []).map((action) => action.label),
    ["probe-broken"]
  )
  assert.deepEqual(issueActions(result, ["probe-broken"]), [])
  assert.deepEqual(
    issueActions(result, ["production-red"]).map((action) => action.label),
    ["probe-broken"]
  )
})

test("report names the step, what it expected and what it saw", () => {
  const lines = report({
    outcome: {
      kind: "product-red",
      sha,
      failures: ["open: expected a, saw b"],
    },
    runs: [{}, {}],
  })
  assert.deepEqual(lines, [
    `PRODUCT RED ${sha} (2 runs)`,
    "  open: expected a, saw b",
  ])
})

test("only reads leave the probe", () => {
  const api = "https://api.example.test"
  assert.ok(readOnlyRequest("GET", `${api}/api/paper`))
  assert.ok(readOnlyRequest("POST", `${api}/api/reads/paper.read`))
  for (const [method, path] of [
    ["POST", "/api/commands/paper.create"],
    ["POST", "/api/paper/import"],
    ["PUT", "/api/paper/x"],
    ["DELETE", "/api/paper/x"],
    ["PATCH", "/api/profile"],
    ["POST", "/api/reads/../commands/paper.delete"],
    ["POST", "/api/reads/paper.read/extra"],
  ])
    assert.equal(
      readOnlyRequest(method, `${api}${path}`),
      false,
      `${method} ${path}`
    )
})

test("the live http port refuses a write without sending it, and sends no redirect-following request", async () => {
  const sent = []
  const http = liveHttp({
    origin: "https://app.example.test",
    fetch: async (url, init) => {
      sent.push(init)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    },
  })
  await assert.rejects(
    http.json("https://api.example.test/api/commands/paper.delete", {
      method: "POST",
      body: {},
    }),
    /makes no writes/
  )
  assert.equal(sent.length, 0)
  await http.json("https://api.example.test/api/session", { session })
  assert.equal(sent[0].redirect, "error")
  assert.equal(sent[0].headers.Cookie, session)
  const lost = liveHttp({
    fetch: async () => {
      throw new Error(`boom ${session}`)
    },
  })
  assert.deepEqual(await lost.json("https://api.example.test/health"), {
    status: 0,
    failure: "no answer",
  })
})

test("the CLI refuses to run without a target and has no production default", async () => {
  const out = []
  const io = {
    out: (line) => out.push(line),
    err: (line) => out.push(line),
    ports: () => assert.fail("no ports without a target"),
  }
  assert.equal(await main([], {}, io), 2)
  assert.match(
    out.join("\n"),
    /Refusing to run: the probe has no target by default/
  )
  assert.match(out.join("\n"), /--api \(PROBE_API\)/)
  assert.match(out.join("\n"), /--sha must be the full commit/)
  const source = readFileSync(
    new URL("./deploy-probe.mjs", import.meta.url),
    "utf8"
  )
  assert.doesNotMatch(source, /opencv\.me/)
})

test("the CLI in dry run against an incident-shaped production prints the step and the planned issue", async () => {
  const out = []
  const fake = production({ pageText: "Document not found." })
  const io = {
    out: (line) => out.push(line),
    err: (line) => out.push(line),
    deployedShas: () => ({ apiSha: sha, webSha: sha }),
    schema: () => schema,
    ports: () => fake.ports,
    issues: {
      openLabels: () => assert.fail("dry run reads no issues"),
      apply: () => assert.fail("dry run changes no issues"),
    },
  }
  const env = {
    PROBE_API: target.api,
    PROBE_WEB: target.web,
    SMOKE_DOC_ID: docId,
    SMOKE_SESSION: session,
  }
  assert.equal(await main(["--sha", sha, "--dry-run"], env, io), 1)
  assert.deepEqual(out, [
    `PRODUCT RED ${sha} (2 runs)`,
    `  open: expected the heading "${heading}" and no "Document not found.", saw Document not found.`,
    "WOULD open issue production-red",
  ])
  assert.ok(!out.join("\n").includes("s3cr3t"))
})

test("the smoke CV fixture and the recorded export both carry the heading", () => {
  assert.equal(smokeHeading(smokeCv), "Linh Nguyen")
  assert.ok(wordParagraphs(exported).includes(heading))
  assert.ok(
    recorded.read.data.paragraphs.some(
      (paragraph) => paragraph.text === heading
    )
  )
})

test("the expected schema is the journal entry with the highest index", () => {
  assert.equal(
    latestMigration({
      entries: [
        { idx: 1, tag: "0001_a" },
        { idx: 3, tag: "0003_c" },
        { idx: 2, tag: "0002_b" },
      ],
    }),
    "0003_c"
  )
  assert.throws(() => latestMigration({ entries: [] }), /no entries/)
})

test("each service is expected at the last commit that changed it", () => {
  const asked = []
  const shas = deployedShas(sha, (args) => {
    asked.push(args)
    return args.some((arg) => arg.includes("apps/web/")) ? `${oldSha}\n` : ""
  })
  assert.deepEqual(shas, { apiSha: sha, webSha: oldSha })
  assert.ok(
    asked.every(
      (args) => args[0] === "log" && args[3] === sha && args[4] === "--"
    )
  )
})
