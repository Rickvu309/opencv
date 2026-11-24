import assert from "node:assert/strict"
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { resolveJar, resolveJava, runTlc } from "../tlc.mjs"
import { tempDir } from "../lib/temp-dir.mjs"
import {
  claimMarker,
  holderOf,
  leaseAt,
  releaseMarker,
} from "./claim-marker.mjs"
import { fixture } from "./jobs/fixture.mjs"

const here = fileURLToPath(new URL(".", import.meta.url))
const TOOLCHAIN = Boolean(resolveJava() && resolveJar())
const NO_TOOLCHAIN =
  "Java or the TLA+ tools are missing, so the model traces were not checked. Install them as scripts/tlc.mjs explains."
const BASE = Date.UTC(2026, 10, 3)
const HOUR_MS = 60 * 60 * 1000
const CLAIM_READS = new Set(["TakeRead", "TakeRaced", "ConfirmRead"])

if (!TOOLCHAIN) process.stderr.write(`SKIP delivery traces: ${NO_TOOLCHAIN}\n`)

export function parseValue(text) {
  let i = 0
  const space = () => {
    while (/\s/.test(text[i] ?? "")) i += 1
  }
  const take = (token) => {
    space()
    if (!text.startsWith(token, i))
      throw new Error(`expected ${token} at ${i}: ${text.slice(i, i + 30)}`)
    i += token.length
  }
  const peek = (token) => {
    space()
    return text.startsWith(token, i)
  }
  const list = (close, item) => {
    const items = []
    if (peek(close)) {
      take(close)
      return items
    }
    for (;;) {
      items.push(item())
      if (peek(",")) take(",")
      else break
    }
    take(close)
    return items
  }
  const value = () => {
    space()
    if (peek("<<")) {
      take("<<")
      return list(">>", value)
    }
    if (peek("[")) {
      take("[")
      const fields = list("]", () => {
        space()
        const name = /^\w+/.exec(text.slice(i))[0]
        i += name.length
        take("|->")
        return [name, value()]
      })
      return Object.fromEntries(fields)
    }
    if (peek('"')) {
      const end = text.indexOf('"', i + 1)
      const s = text.slice(i + 1, end)
      i = end + 1
      return s
    }
    const word = /^-?\w+/.exec(text.slice(i))[0]
    i += word.length
    if (word === "TRUE") return true
    if (word === "FALSE") return false
    return Number(word)
  }
  const result = value()
  space()
  if (i !== text.length) throw new Error(`trailing text at ${i}`)
  return result
}

export function parseDump(text) {
  return text
    .split(/^State \d+:.*$/m)
    .slice(1)
    .map((block) =>
      Object.fromEntries(
        block
          .trim()
          .split(/^\/\\ /m)
          .filter(Boolean)
          .map((part) => {
            const at = part.indexOf(" = ")
            return [part.slice(0, at).trim(), parseValue(part.slice(at + 3))]
          })
      )
    )
}

function statesOf(t, spec, cfgText) {
  const dir = tempDir(t, "delivery-trace-")
  const specCopy = join(dir, spec.split("/").at(-1))
  copyFileSync(join(here, spec), specCopy)
  const cfg = specCopy.replace(/\.tla$/, ".cfg")
  writeFileSync(cfg, cfgText)
  const dump = join(dir, "states.dump")
  const run = runTlc({ spec: specCopy, cfg, dump })
  assert.equal(run.code, 0, run.output.split("\n").slice(-20).join("\n"))
  const file = existsSync(dump) ? dump : `${dump}.dump`
  return parseDump(readFileSync(file, "utf8"))
}

const iso = (hours) => new Date(BASE + hours * HOUR_MS).toISOString()

function claimComments(comments) {
  return comments.map((c, index) => ({
    databaseId: index + 1,
    body:
      c.kind === "claim"
        ? claimMarker({ agent: c.agent, at: iso(c.at), branch: "chore/1-take" })
        : releaseMarker({ agent: c.agent, at: iso(c.at), reason: "foreign" }),
    createdAt: iso(c.stamp),
    updatedAt: iso(c.stamp),
  }))
}

export function claimDisagreements(states) {
  const found = []
  for (const s of states) {
    const [agent, action] = s.last
    if (!CLAIM_READS.has(action)) continue
    const model = s.seen[agent]
    const comments = claimComments(s.comments)
    const now = BASE + s.now * HOUR_MS
    const code = holderOf(comments, now)
    const lease =
      code.state === "live" || code.state === "idle"
        ? leaseAt(comments.at(-1), now)
        : null
    const codeView = {
      state: code.state,
      agent: code.agent ?? "none",
      lease: lease == null ? -1 : (lease - BASE) / HOUR_MS,
    }
    if (
      codeView.state !== model.state ||
      codeView.agent !== model.agent ||
      codeView.lease !== model.lease
    )
      found.push({ action, agent, model, code: codeView, now: s.now })
  }
  return found
}

const claimCfg = ({ agents, maxTime, maxComments, trustAt = false }) =>
  [
    "SPECIFICATION Spec",
    "CONSTANTS",
    `    Agents = {${agents.map((a) => `"${a}"`).join(", ")}}`,
    '    Foreign = "x"',
    "    Confirm = TRUE",
    `    TrustAt = ${trustAt ? "TRUE" : "FALSE"}`,
    "    Idle = 3",
    "    Skew = 0",
    `    MaxTime = ${maxTime}`,
    `    MaxComments = ${maxComments}`,
    "CHECK_DEADLOCK FALSE",
    "",
  ].join("\n")

test("the TLA value reader reads records, sequences, strings and numbers", () => {
  assert.deepEqual(
    parseValue('<<[kind |-> "claim", at |-> -1, ok |-> TRUE], <<>>>>'),
    [{ kind: "claim", at: -1, ok: true }, []]
  )
  assert.deepEqual(
    parseDump(
      'State 1: <Initial predicate>\n/\\ now = 0\n/\\ last = <<"env", "Init">>\n\nState 2: <Tick>\n/\\ now = 1\n/\\ last = <<"env", "Tick">>\n'
    ),
    [
      { now: 0, last: ["env", "Init"] },
      { now: 1, last: ["env", "Tick"] },
    ]
  )
})

test(
  "holderOf and leaseAt agree with every claim read the model makes, for two takers",
  { skip: !TOOLCHAIN && NO_TOOLCHAIN },
  (t) => {
    const states = statesOf(
      t,
      "TakeClaim.tla",
      claimCfg({ agents: ["a", "b"], maxTime: 1, maxComments: 2 })
    )
    const reads = states.filter((s) => CLAIM_READS.has(s.last[1]))
    assert.ok(reads.length > 100, `only ${reads.length} reads`)
    assert.deepEqual(claimDisagreements(states).slice(0, 3), [])
  }
)

test(
  "holderOf and leaseAt agree with the model as claims age and stamps run ahead",
  { skip: !TOOLCHAIN && NO_TOOLCHAIN },
  (t) => {
    const states = statesOf(
      t,
      "TakeClaim.tla",
      claimCfg({ agents: ["a"], maxTime: 4, maxComments: 2 })
    )
    const seenStates = new Set(
      states
        .filter((s) => CLAIM_READS.has(s.last[1]))
        .map((s) => s.seen[s.last[0]].state)
    )
    assert.deepEqual([...seenStates].sort(), [
      "idle",
      "live",
      "none",
      "released",
    ])
    assert.deepEqual(claimDisagreements(states).slice(0, 3), [])
  }
)

test(
  "a model whose lease trusts the at= stamp disagrees with leaseAt",
  { skip: !TOOLCHAIN && NO_TOOLCHAIN },
  (t) => {
    const states = statesOf(
      t,
      "TakeClaim.tla",
      claimCfg({ agents: ["a"], maxTime: 1, maxComments: 1, trustAt: true })
    )
    assert.ok(claimDisagreements(states).length > 0)
  }
)

test("a merge that lands at a foreign head right after the merge request is not reported merged", () => {
  const f = fixture({ mergeLater: true })
  const queued = () => f.effects("gh", "pr merge").length > 0
  Object.defineProperties(f.s.pull, {
    state: { get: () => (queued() ? "MERGED" : "OPEN") },
    headRefOid: { get: () => (queued() ? "head-2" : "head-1") },
    mergeCommit: { get: () => (queued() ? { oid: "merged-2" } : null) },
  })
  const r = f.call("merge", "91")
  assert.doesNotMatch(r.text, /Merged PR #91/)
  assert.equal(f.s.issueState, "OPEN")
  assert.equal(f.effects("gh", "issue close").length, 0)
})
