#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { parseArgs } from "node:util"
import { fileURLToPath, pathToFileURL } from "node:url"

import {
  liveBrowser,
  liveClock,
  liveHttp,
  liveIssues,
} from "./deploy-probe-live.mjs"
import { wordParagraphs } from "./deploy-probe-word.mjs"
import { services } from "./pr/services.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
export const SMOKE_CV = join(repoRoot, "scripts/fixtures/probe/smoke-cv.docx")
export const DEPLOY_WAIT_MS = 10 * 60_000
export const DEPLOY_POLL_MS = 15_000
export const CONFIRM_GAP_MS = 60_000
const SAW_LIMIT = 160
const MISSING_PAGE = "Document not found."
const PAGE_FAILED = "Could not load documents"
const WORD_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

export function bounded(value, secrets = []) {
  let text = typeof value === "string" ? value : (JSON.stringify(value) ?? "")
  for (const secret of secrets) {
    if (secret) text = text.split(secret).join("[withheld]")
  }
  text = text
    .replace(/[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}/gi, "[email]")
    .replace(/\s+/g, " ")
    .trim()
  return text.length > SAW_LIMIT ? `${text.slice(0, SAW_LIMIT)}…` : text
}

export function smokeHeading(bytes = readFileSync(SMOKE_CV)) {
  const [heading] = wordParagraphs(bytes)
  if (!heading) throw new Error("the smoke CV fixture has no text")
  return heading
}

export function latestMigration(journal) {
  const entries = journal?.entries ?? []
  const last = entries.reduce(
    (latest, entry) =>
      latest === null || entry.idx > latest.idx ? entry : latest,
    null
  )
  if (!last?.tag) throw new Error("the migration journal has no entries")
  return last.tag
}

const SESSION_COOKIE = /^[A-Za-z0-9_.-]+=[^;\s]+$/

export function parseTarget(input) {
  const problems = []
  const url = (name, value, example) => {
    try {
      const parsed = new URL(value ?? "")
      if (!/^https?:$/.test(parsed.protocol)) throw new Error()
      return parsed.origin
    } catch {
      problems.push(
        `${name} must be the full origin to check, for example ${example}`
      )
      return null
    }
  }
  const target = {
    api: url("--api (PROBE_API)", input.api, "http://localhost:4469"),
    web: url("--web (PROBE_WEB)", input.web, "http://localhost:5469"),
    docId: input.docId ?? "",
    session: input.session ?? "",
  }
  if (problems.length > 0) return { ok: false, problems }
  return { ok: true, target }
}

function step(failures, secrets) {
  return (name, expected, saw) =>
    failures.push(`${name}: expected ${expected}, saw ${bounded(saw, secrets)}`)
}

async function waitForDeploy(ports, target, apiSha) {
  const deadline = ports.clock.now() + DEPLOY_WAIT_MS
  let last = "no answer"
  for (;;) {
    const health = await ports.http.json(`${target.api}/health`)
    if (health.status === 200 && health.body?.sha === apiSha)
      return { ok: true, health }
    last =
      health.status === 200
        ? `sha ${health.body?.sha ?? "null"}`
        : (health.failure ?? `HTTP ${health.status}`)
    if (ports.clock.now() + DEPLOY_POLL_MS > deadline)
      return { ok: false, last }
    await ports.clock.pause(DEPLOY_POLL_MS)
  }
}

export async function probe(ports, sha, schema, target, expected = {}) {
  const apiSha = expected.apiSha ?? sha
  const webSha = expected.webSha ?? sha
  const heading = expected.heading ?? smokeHeading()
  const secrets = [target.session]
  const failures = []
  const fail = step(failures, secrets)
  const broken = (reason) => ({
    kind: "probe-broken",
    reason: bounded(reason, secrets),
  })
  const red = () => ({ kind: "product-red", sha, failures })

  if (!SESSION_COOKIE.test(target.session ?? ""))
    return broken(
      "the smoke session is missing or is not a name=value cookie (secret SMOKE_SESSION)"
    )
  if (!/^[0-9a-f-]{36}$/i.test(target.docId ?? ""))
    return broken(
      "the smoke CV id is missing or is not a document id (secret SMOKE_DOC_ID)"
    )

  const deployed = await waitForDeploy(ports, target, apiSha)
  if (!deployed.ok) {
    fail(
      "health",
      `sha ${apiSha} within ${DEPLOY_WAIT_MS / 60_000} min`,
      deployed.last
    )
    return red()
  }
  if (deployed.health.body.pdfReading !== true)
    fail(
      "health",
      "pdfReading true",
      `pdfReading ${deployed.health.body.pdfReading}`
    )

  const deep = await ports.http.json(`${target.api}/health/deep`)
  if (deep.body?.db !== true)
    fail("deep health", "db true", `HTTP ${deep.status}, db ${deep.body?.db}`)
  if (deep.body?.schemaVersion !== schema)
    fail(
      "deep health",
      `schemaVersion ${schema}`,
      `schemaVersion ${deep.body?.schemaVersion ?? "null"}`
    )

  const version = await ports.http.text(`${target.web}/version.txt`)
  if (version.status !== 200 || version.text.trim() !== webSha)
    fail("web version", `${webSha}`, `HTTP ${version.status} ${version.text}`)

  const session = await ports.http.json(`${target.api}/api/session`, {
    session: target.session,
  })
  if (session.status === 401 || session.status === 403)
    return broken(
      `the smoke session was refused (HTTP ${session.status}); sign the smoke account in again and replace SMOKE_SESSION`
    )
  if (session.status !== 200) {
    fail("session", "HTTP 200", `HTTP ${session.status}`)
    return red()
  }

  const list = await ports.http.json(`${target.api}/api/paper?kind=cv`, {
    session: target.session,
  })
  const listed = Array.isArray(list.body?.data)
    ? list.body.data.find((item) => item.id === target.docId)
    : undefined
  if (list.status !== 200 || !Array.isArray(list.body?.data))
    fail("library", "HTTP 200 with a list of CVs", `HTTP ${list.status}`)
  else if (!listed)
    fail(
      "library",
      "the smoke CV in the list",
      `${list.body.data.length} CVs, none with the smoke CV id`
    )
  else if (listed.format !== "word")
    fail(
      "library",
      "the smoke CV listed as a Word page",
      `format ${listed.format}`
    )

  const read = await ports.http.json(`${target.api}/api/reads/paper.read`, {
    method: "POST",
    body: { view: "page", docId: target.docId },
    session: target.session,
  })
  const paragraphs = Array.isArray(read.body?.data?.paragraphs)
    ? read.body.data.paragraphs
    : []
  const revision = read.body?.data?.revision
  if (read.status !== 200 || typeof revision !== "string")
    fail(
      "page read",
      "HTTP 200 with a revision",
      `HTTP ${read.status} ${read.body?.error?.message ?? ""}`
    )
  else if (!paragraphs.some((paragraph) => paragraph.text === heading))
    fail(
      "page read",
      `the heading "${heading}"`,
      `${paragraphs.length} paragraphs without it`
    )

  const page = await ports.browser.visibleText(
    `${target.web}/paper/${target.docId}`,
    {
      session: target.session,
      api: target.api,
      settle: [heading, MISSING_PAGE, PAGE_FAILED],
    }
  )
  const pageSaw = [MISSING_PAGE, PAGE_FAILED].find((marker) =>
    page.text.includes(marker)
  )
  if (pageSaw || !page.text.includes(heading))
    fail(
      "open",
      `the heading "${heading}" and no "${MISSING_PAGE}"`,
      pageSaw ??
        `a page without the heading (${page.text.length} characters of text)`
    )

  if (typeof revision === "string") {
    const word = await ports.http.bytes(
      `${target.api}/api/paper/packages/${target.docId}/export?at=${encodeURIComponent(revision)}`,
      { session: target.session }
    )
    if (word.status !== 200 || !word.type.startsWith(WORD_TYPE)) {
      fail(
        "Word download",
        `HTTP 200 ${WORD_TYPE}`,
        `HTTP ${word.status} ${word.type}`
      )
    } else {
      try {
        const words = wordParagraphs(word.bytes)
        if (!words.includes(heading))
          fail(
            "Word download",
            `the heading "${heading}" in the file`,
            `${words.length} paragraphs without it`
          )
      } catch (error) {
        fail("Word download", "a Word file that parses", error.message)
      }
    }
  }

  return failures.length === 0 ? { kind: "pass", sha } : red()
}

export async function confirmed(ports, run) {
  const first = await run()
  if (first.kind !== "product-red") return { outcome: first, runs: [first] }
  await ports.clock.pause(CONFIRM_GAP_MS)
  const second = await run()
  return { outcome: second, runs: [first, second] }
}

export const ISSUE_LABELS = { red: "production-red", broken: "probe-broken" }

export function issueActions(result, openLabels) {
  const open = new Set(openLabels)
  const { outcome, runs } = result
  if (outcome.kind === "pass")
    return [ISSUE_LABELS.red, ISSUE_LABELS.broken]
      .filter((label) => open.has(label))
      .map((label) => ({
        do: "close",
        label,
        note: `Probe passed on ${outcome.sha}.`,
      }))
  if (outcome.kind === "probe-broken")
    return open.has(ISSUE_LABELS.broken)
      ? []
      : [{ do: "open", label: ISSUE_LABELS.broken, note: outcome.reason }]
  const bothRed =
    runs.length === 2 && runs.every((run) => run.kind === "product-red")
  if (!bothRed || open.has(ISSUE_LABELS.red)) return []
  return [
    {
      do: "open",
      label: ISSUE_LABELS.red,
      note: [
        `Production is red on ${outcome.sha} twice, ${CONFIRM_GAP_MS / 1000} s apart.`,
        ...outcome.failures,
      ].join("\n"),
    },
  ]
}

export function report(result) {
  const { outcome } = result
  if (outcome.kind === "pass") return [`PASS probe ${outcome.sha}`]
  if (outcome.kind === "probe-broken") return [`PROBE BROKEN ${outcome.reason}`]
  return [
    `PRODUCT RED ${outcome.sha} (${result.runs.length} run${result.runs.length === 1 ? "" : "s"})`,
    ...outcome.failures.map((failure) => `  ${failure}`),
  ]
}

function lastChange(sha, patterns, git) {
  return git([
    "log",
    "-1",
    "--format=%H",
    sha,
    "--",
    ...patterns.map((pattern) => `:(glob)${pattern}`),
  ]).trim()
}

export function deployedShas(sha, git) {
  const of = (name) =>
    services.find((service) => service.name === name).watchPatterns
  return {
    apiSha: lastChange(sha, of("api"), git) || sha,
    webSha: lastChange(sha, of("web"), git) || sha,
  }
}

function gitIn(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
}

export async function main(argv, env, io) {
  const { values } = parseArgs({
    args: argv,
    options: {
      sha: { type: "string" },
      api: { type: "string" },
      web: { type: "string" },
      schema: { type: "string" },
      "api-sha": { type: "string" },
      "web-sha": { type: "string" },
      "dry-run": { type: "boolean", default: false },
      "no-confirm": { type: "boolean", default: false },
    },
  })
  const parsed = parseTarget({
    api: values.api ?? env.PROBE_API,
    web: values.web ?? env.PROBE_WEB,
    docId: env.SMOKE_DOC_ID,
    session: env.SMOKE_SESSION,
  })
  const sha = values.sha ?? ""
  const refusals = [
    ...(parsed.ok ? [] : parsed.problems),
    ...(/^[0-9a-f]{40}$/.test(sha)
      ? []
      : ["--sha must be the full commit to expect"]),
  ]
  if (refusals.length > 0) {
    io.err(
      [
        "Refusing to run: the probe has no target by default.",
        ...refusals.map((line) => `  ${line}`),
      ].join("\n")
    )
    return 2
  }
  const target = parsed.target
  const shas = io.deployedShas(sha)
  const expected = {
    apiSha: values["api-sha"] ?? shas.apiSha,
    webSha: values["web-sha"] ?? shas.webSha,
    heading: smokeHeading(),
  }
  const schema = values.schema ?? io.schema()
  const ports = io.ports(target)
  const run = () => probe(ports, sha, schema, target, expected)
  const result = values["no-confirm"]
    ? { outcome: await run(), runs: [] }
    : await confirmed(ports, run)
  if (result.runs.length === 0) result.runs.push(result.outcome)
  for (const line of report(result)) io.out(line)
  const actions = issueActions(
    result,
    values["dry-run"] ? [] : io.issues.openLabels()
  )
  for (const action of actions) {
    io.out(
      `${values["dry-run"] ? "WOULD" : "DO"} ${action.do} issue ${action.label}`
    )
    if (!values["dry-run"]) io.issues.apply(action)
  }
  return { pass: 0, "product-red": 1, "probe-broken": 3 }[result.outcome.kind]
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const io = {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
    deployedShas: (sha) => deployedShas(sha, gitIn),
    schema: () =>
      latestMigration(
        JSON.parse(
          readFileSync(
            join(repoRoot, "apps/api/drizzle/meta/_journal.json"),
            "utf8"
          )
        )
      ),
    ports: (target) => ({
      http: liveHttp({ origin: target.web }),
      browser: liveBrowser(),
      clock: liveClock(),
    }),
    issues: liveIssues({ labels: ISSUE_LABELS }),
  }
  main(process.argv.slice(2), process.env, io).then(
    (code) => {
      process.exitCode = code
    },
    (error) => {
      process.stderr.write(
        `PROBE BROKEN ${bounded(error.message, [process.env.SMOKE_SESSION])}\n`
      )
      process.exitCode = 1
    }
  )
}
