import { run } from "./common.mjs"
import { guardFilesOf, judge, kindOf, RETIRED_FILE } from "./protected.mjs"

const ZERO = /^0+$/
const READ_AS_TEXT = new Set([
  "test",
  "guard",
  "acceptance",
  "ratchet",
  "ledger",
  "checker-config",
  "bound",
])
const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/
const CODE = /\.[cm]?[jt]sx?$/

function gitOut(ctx, args, cwd) {
  const r = run(ctx, "git", args, { raw: true, ...(cwd ? { cwd } : {}) })
  if (!r.ok)
    throw new Error(
      `git ${args.slice(0, 3).join(" ")} failed (${r.err || "no output"}), so protected checks cannot be read; run git fetch origin main`
    )
  return r.out
}

export function rawChanges(ctx, base, head, cwd) {
  const tokens = gitOut(
    ctx,
    ["diff", "--raw", "-z", "--no-renames", "--no-abbrev", base, head],
    cwd
  ).split("\0")
  const changes = []
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const meta = tokens[i].trim()
    if (!meta.startsWith(":")) break
    const [, , baseBlob, headBlob] = meta.slice(1).split(" ")
    changes.push({
      path: tokens[i + 1],
      baseBlob: ZERO.test(baseBlob) ? null : baseBlob,
      headBlob: ZERO.test(headBlob) ? null : headBlob,
    })
  }
  return changes
}

const blob = (ctx, oid, cwd) =>
  oid ? gitOut(ctx, ["cat-file", "blob", oid], cwd) : null

export function readRetirements(ctx, changes, cwd) {
  const out = []
  for (const change of changes) {
    const m = RETIRED_FILE.exec(change.path)
    if (!m || !change.headBlob) continue
    let rows
    try {
      rows = JSON.parse(blob(ctx, change.headBlob, cwd))
    } catch {
      rows = null
    }
    if (!Array.isArray(rows)) {
      out.push({ file: change.path, issue: Number(m[1]), broken: true })
      continue
    }
    for (const row of rows)
      out.push({ ...row, file: change.path, issue: Number(m[1]) })
  }
  return out
}

export function guardsAt(ctx, fork, cwd) {
  const at = cwd ? { cwd } : {}
  const r = run(
    ctx,
    "git",
    [
      "grep",
      "-h",
      "-o",
      "-E",
      '"file": *"[^"]+"',
      fork,
      "--",
      "scripts/guard-ledger/",
    ],
    at
  )
  const rows = r.ok
    ? r.out
        .split("\n")
        .map((line) => /"file": *"([^"]+)"/.exec(line)?.[1])
        .filter(Boolean)
    : []
  const baseline = run(
    ctx,
    "git",
    ["show", `${fork}:scripts/guard-ledger.baseline.json`],
    at
  )
  return new Set([...rows, ...guardFilesOf(baseline.ok ? [baseline.out] : [])])
}

export function filesOf(ctx, changes, cwd) {
  return changes.map((change) => {
    const kind = change.baseBlob ? kindOf(change.path) : null
    const asText =
      (kind && READ_AS_TEXT.has(kind)) ||
      TEST.test(change.path) ||
      CODE.test(change.path) ||
      (kind && /\.json$/.test(change.path))
    const text = (oid) => (asText ? blob(ctx, oid, cwd) : oid)
    return {
      path: change.path,
      kind,
      baseBlob: change.baseBlob,
      headBlob: change.headBlob,
      baseText: change.baseBlob ? text(change.baseBlob) : null,
      headText: change.headBlob ? text(change.headBlob) : null,
    }
  })
}

export function protectedFacts(ctx, base, head, { cwd } = {}) {
  const fork = gitOut(ctx, ["merge-base", base, head], cwd).trim()
  const changes = rawChanges(ctx, fork, head, cwd)
  const retirements = readRetirements(ctx, changes, cwd)
  const files = filesOf(ctx, changes, cwd)
  const live = retirements.filter((r) => !r.broken)
  let verdict = judge(files, live)
  if (verdict.weakened.length || verdict.retired.length) {
    const guards = guardsAt(ctx, fork, cwd)
    verdict = judge(
      files.map((f) => ({
        ...f,
        kind: f.baseBlob ? kindOf(f.path, { guards }) : null,
      })),
      live
    )
  }
  return {
    base: fork,
    head,
    weakened: verdict.weakened,
    retired: verdict.retired,
    retirements,
    files,
    changed: changes.map((change) => ({
      path: change.path,
      baseBlob: change.baseBlob,
      headBlob: change.headBlob,
    })),
  }
}

export function unreadableProtected(error) {
  return {
    weakened: [
      {
        path: "",
        kind: "test",
        what: "unreadable",
        subject: String(error.message).split("\n")[0],
      },
    ],
    retired: [],
    retirements: [],
    changed: [],
  }
}

export function pushedProtectedFacts(ctx, shas, cwd) {
  const merged = { weakened: [], retired: [], retirements: [], changed: [] }
  for (const sha of shas) {
    if (!run(ctx, "git", ["merge-base", "origin/main", sha], { cwd }).ok)
      continue
    let facts
    try {
      facts = protectedFacts(ctx, "origin/main", sha, { cwd })
    } catch (error) {
      facts = unreadableProtected(error)
    }
    for (const key of Object.keys(merged)) merged[key].push(...facts[key])
  }
  return merged
}

export function recordedProtectedFacts(ctx, base, head, { cwd } = {}) {
  const fork = gitOut(ctx, ["merge-base", base, head], cwd).trim()
  const changes = rawChanges(ctx, fork, head, cwd)
  const retirements = readRetirements(ctx, changes, cwd)
  return {
    recorded: true,
    weakened: [],
    retired: retirements.map((r) => ({
      subject: r.subject ?? r.file,
      retiredBy: r.subject ?? r.file,
      class: !r.broken && r.class === "self" ? "self" : "owner",
      because: r.broken
        ? `an unreadable ${r.file}`
        : r.class === "self"
          ? null
          : (r.classBecause ?? "no recorded proof of a covering replacement"),
      count: Number.isInteger(r.items) && r.items > 0 ? r.items : 1,
    })),
    retirements,
    changed: changes.map((change) => ({
      path: change.path,
      baseBlob: change.baseBlob,
      headBlob: change.headBlob,
    })),
  }
}

export function branchVerdict(ctx, base, head, { cwd } = {}) {
  let facts
  try {
    facts = protectedFacts(ctx, base, head, { cwd })
  } catch (error) {
    facts = unreadableProtected(error)
  }
  return facts
}
