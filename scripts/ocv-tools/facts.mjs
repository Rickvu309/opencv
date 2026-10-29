// One loader per run. Each fact kind is read once and cached. A race check
// passes fresh: true, which is the only way take and save read an issue again.
import { holderOf } from "./claim-marker.mjs"
import { RISKS, TYPES } from "./fields.mjs"
import { parseRisk } from "./lint.mjs"
import { Refused } from "./result.mjs"

const loginOf = (author) =>
  String(
    typeof author === "string" ? author : (author?.login ?? "")
  ).toLowerCase()

// The newest owner comment starting with /approve must follow the last body edit
// (or the creation, if the body was never edited).
export function approvalValid({ comments, owner, lastEditedAt, createdAt }) {
  const since = Date.parse(lastEditedAt || createdAt)
  if (Number.isNaN(since)) return false
  let newest = null
  for (const c of comments ?? []) {
    if (loginOf(c.author) !== String(owner ?? "").toLowerCase()) continue
    if (!/^\/approve\b/.test(String(c.body ?? "").trimStart())) continue
    const at = Date.parse(c.createdAt)
    if (Number.isNaN(at)) continue
    if (newest === null || at > newest) newest = at
  }
  return newest !== null && newest > since
}

// Approval must never fail open: a conflicting label set counts as high, and a
// missing label falls back to the Risk answer in the issue body.
export function riskOf(labels, body = "") {
  const found = RISKS.filter((r) => labels.includes(`risk:${r}`))
  if (found.length > 1) return "high"
  if (found.length === 1) return found[0]
  return parseRisk(body)
}

function issueFact(record, owner) {
  const labels = record.labels ?? []
  const comments = Object.freeze(
    (record.comments ?? []).map((c) => Object.freeze({ ...c }))
  )
  return Object.freeze({
    n: record.n,
    title: record.title,
    state: record.state,
    body: record.body ?? "",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastEditedAt: record.lastEditedAt,
    labels: Object.freeze([...labels]),
    assignees: Object.freeze([...(record.assignees ?? [])]),
    comments,
    owner,
    risk: riskOf(labels, record.body ?? ""),
    type:
      TYPES.find(
        (t) => labels.includes(t) || String(record.title).startsWith(`${t}:`)
      ) ?? null,
    approved: approvalValid({
      comments,
      owner,
      lastEditedAt: record.lastEditedAt,
      createdAt: record.createdAt,
    }),
  })
}

function prefixOf(n) {
  return new RegExp(`^(?:${TYPES.join("|")})/${n}-`)
}

export function createFacts(ports, cwdOf = () => undefined) {
  const cache = new Map()
  const cwd = () => (typeof cwdOf === "function" ? cwdOf() : cwdOf)

  function invalidate(n, kinds) {
    for (const kind of kinds) {
      if (kind === "issue" || kind === "claim") {
        cache.delete(`issue:${n}`)
        cache.delete(`claim:${n}`)
        cache.delete(`server:${n}`)
      }
      if (kind === "local") {
        cache.delete("worktrees")
        cache.delete("remoteHeads")
        cache.delete(`local:${n}`)
      }
      if (kind === "pr") {
        cache.delete("prs")
        cache.delete(`pr:${n}`)
      }
    }
  }

  function bundle(n) {
    const key = `issue:${n}`
    if (cache.has(key))
      return {
        issue: cache.get(key),
        claim: cache.get(`claim:${n}`),
        serverNow: cache.get(`server:${n}`),
      }
    const loaded = ports.gh.issue(n)
    if (loaded.history === "stuck")
      throw new Refused(
        "UNKNOWN",
        `claim history for #${n} stopped before the first comment (the page cursor did not move)`
      )
    if (loaded.history === "cap")
      throw new Refused(
        "UNKNOWN",
        `claim history for #${n} is incomplete: ${loaded.pageCap} pages were read and older comments remain`
      )
    if (!loaded.record)
      throw new Refused("NOT_AN_ISSUE", `#${n} is not an issue`)
    const issue = issueFact(loaded.record, loaded.owner)
    const claim = Object.freeze(holderOf(issue.comments, loaded.serverNow))
    cache.set(key, issue)
    cache.set(`claim:${n}`, claim)
    cache.set(`server:${n}`, loaded.serverNow)
    return { issue, claim, serverNow: loaded.serverNow }
  }

  function worktreeList() {
    if (!cache.has("worktrees"))
      cache.set("worktrees", Object.freeze(ports.git.worktrees(cwd())))
    return cache.get("worktrees")
  }

  function remoteHeads() {
    if (!cache.has("remoteHeads"))
      cache.set("remoteHeads", Object.freeze(ports.git.remoteHeads(cwd())))
    return cache.get("remoteHeads")
  }

  function localFact(n) {
    const key = `local:${n}`
    if (cache.has(key)) return cache.get(key)
    const prefix = prefixOf(n)
    const list = worktreeList()
    const hit = list.find((w) => prefix.test(w.branch))
    const remoteBranch = hit
      ? null
      : (remoteHeads().find((name) => prefix.test(name)) ?? null)
    const fact = Object.freeze({
      worktrees: list,
      worktree: hit?.path ?? null,
      branch: hit?.branch ?? remoteBranch,
      remoteBranch,
    })
    cache.set(key, fact)
    return fact
  }

  function prList() {
    if (!cache.has("prs"))
      cache.set(
        "prs",
        Object.freeze(ports.gh.prs({ state: "all", limit: 200 }))
      )
    return cache.get("prs")
  }

  function prFact(n) {
    const key = `pr:${n}`
    if (cache.has(key)) return cache.get(key)
    const prefix = prefixOf(n)
    const all = Object.freeze(
      prList().filter((p) => prefix.test(p.headRefName))
    )
    const current = all.find((p) => p.state === "OPEN") ?? all[0] ?? null
    const fact = Object.freeze({ all, current })
    cache.set(key, fact)
    return fact
  }

  function load(n, kinds, { fresh = false } = {}) {
    if (fresh) invalidate(n, kinds)
    const out = {}
    if (kinds.includes("issue") || kinds.includes("claim")) {
      const bag = bundle(n)
      if (kinds.includes("issue")) out.issue = bag.issue
      if (kinds.includes("claim")) out.claim = bag.claim
      out.serverNow = bag.serverNow
    }
    if (kinds.includes("local")) out.local = localFact(n)
    if (kinds.includes("pr")) out.pr = prFact(n)
    return out
  }

  return { load, invalidate }
}
