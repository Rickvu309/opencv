import { createRequire } from "node:module"
import { MARKS, normalise, parseTests } from "./protected-tests.mjs"

const ts = createRequire(import.meta.url)("typescript")

export { RETIRED_DIR, RETIRED_FILE } from "../rules/merge-gate.mjs"

const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/
const ACCEPTANCE = /(?:^|\/)acceptance\/[^/]+\.test\.[cm]?[jt]sx?$/
const GUARD = /^(?:scripts|packages\/guards)\//
const LEDGER_ROW = /^scripts\/guard-ledger\/[^/]+\.json$/
const CORPUS = /(?:^|\/)(?:corpus|corpora)\/|-corpus\.[a-z]+$/
const FIXTURE_DIR =
  /(?:^|\/)(?:fixtures|__fixtures__|__snapshots__|[^/]+[-.]fixtures)\//
const FIXTURE_NAME =
  /\.(?:snapshot\.json|snap|golden\.[a-z]+|expected\.[a-z]+)$/
const CODE = /\.[cm]?[jt]sx?$/
const RATCHET =
  /(?:^|\/)[^/]*(?:known-reds|known-failures|baseline|ratchet|waivers)[^/]*\.json$/
const BOUND = /^packages\/domain\/src\/limits\/(?!.*\.test\.)[^]*\.ts$/

export const CHECKER_CONFIG = Object.freeze({
  "apps/web/vitest.quarantine.ts": { shrinks: ["quarantine"] },
  "apps/web/vitest.config.ts": { keeps: [] },
  "scripts/ocv-tools/jobs/test-selection.mjs": {
    grows: ["TREE_SCANS"],
    floors: ["LOCAL_CAP", "MAX_PER_RUNNER"],
  },
  "packages/guards/run-tests.mjs": { frozen: true },
})

const BOUND_LOOSER = Object.freeze({
  oneKeyShare: "up",
  keysToDenyAll: "down",
  targetedDenialMs: "up",
  uses: "down",
})

export function kindOf(path, acceptance = new Set()) {
  if (acceptance.has(path) || ACCEPTANCE.test(path)) return "acceptance"
  if (path in CHECKER_CONFIG) {
    const spec = CHECKER_CONFIG[path]
    return spec.keeps ? null : "checker-config"
  }
  if (LEDGER_ROW.test(path)) return "ledger"
  if (RATCHET.test(path)) return "ratchet"
  if (TEST.test(path)) return GUARD.test(path) ? "guard" : "test"
  if (BOUND.test(path)) return "bound"
  if (CORPUS.test(path)) return "corpus"
  if ((FIXTURE_DIR.test(path) && !CODE.test(path)) || FIXTURE_NAME.test(path))
    return "fixture"
  return null
}

export function protectedSet(paths, acceptance = []) {
  const accepted = new Set(acceptance)
  const set = new Map()
  for (const path of paths) {
    const kind = kindOf(path, accepted)
    if (kind) set.set(path, kind)
  }
  return set
}

const weak = (path, kind, what, subject, extra = {}) => ({
  path,
  kind,
  what,
  subject,
  ...extra,
})

function multiset(list) {
  const counts = new Map()
  for (const item of list) counts.set(item, (counts.get(item) ?? 0) + 1)
  return counts
}

function minus(base, head) {
  const left = multiset(head)
  const gone = []
  for (const item of base) {
    const n = left.get(item) ?? 0
    if (n > 0) left.set(item, n - 1)
    else gone.push(item)
  }
  return gone
}

const RUNS_NOTHING = new Set(["skip", "todo"])

export function tightens(was, now) {
  const [wasCall, wasLiterals = ""] = was.split("|")
  const [nowCall, nowLiterals = ""] = now.split("|")
  if (wasCall !== nowCall) return false
  const need = wasLiterals ? wasLiterals.split("\u0001") : []
  const have = nowLiterals ? nowLiterals.split("\u0001") : []
  if (have.length <= need.length) return false
  return minus(need, have).length === 0
}

function testWeakenings(baseText, headText, path, kind) {
  const base = parseTests(path, baseText)
  if (headText === null) {
    const out = [weak(path, kind, "file-removed", path, { moved: [] })]
    for (const [key, item] of base.cases)
      if (![...item.marks].some((m) => RUNS_NOTHING.has(m)))
        out[0].moved.push({
          key,
          title: item.title,
          assertions: item.assertions.map((a) => a.meaning),
        })
    for (const [name, rows] of base.tables)
      for (const row of rows) out[0].moved.push({ key: name, row })
    return out
  }
  const head = parseTests(path, headText)
  const out = []
  for (const [key, item] of base.cases) {
    const now = head.cases.get(key)
    const ranNothing = [...item.marks].some((m) => RUNS_NOTHING.has(m))
    if (!now) {
      if (!ranNothing)
        out.push(
          weak(path, kind, "case-removed", `${path} > ${key}`, {
            title: item.title,
            assertions: item.assertions.map((a) => a.meaning),
          })
        )
      continue
    }
    const added = [...now.marks].filter((m) => !item.marks.has(m))
    for (const mark of new Set(added))
      out.push(weak(path, kind, "skipped", `${path} > ${key} (.${mark})`))
    const gone = minus(
      item.assertions.map((a) => a.meaning),
      now.assertions.map((a) => a.meaning)
    )
    const fresh = minus(
      now.assertions.map((a) => a.meaning),
      item.assertions.map((a) => a.meaning)
    )
    const freshTargets = new Set(
      now.assertions
        .filter((a) => fresh.includes(a.meaning))
        .map((a) => a.target)
    )
    const spare = [...fresh]
    for (const meaning of gone) {
      const tighter = spare.findIndex((next) => tightens(meaning, next))
      if (tighter !== -1) {
        spare.splice(tighter, 1)
        continue
      }
      const was = item.assertions.find((a) => a.meaning === meaning)
      const what = freshTargets.has(was.target)
        ? "expected-changed"
        : "assertion-removed"
      out.push(
        weak(path, kind, what, `${path} > ${key} :: ${was.text}`, {
          assertions: [meaning],
        })
      )
    }
  }
  for (const [key, item] of head.cases)
    if (!base.cases.has(key) && item.marks.has(MARKS.only))
      out.push(weak(path, kind, "skipped", `${path} > ${key} (.only)`))
  for (const [name, rows] of base.tables) {
    const gone = minus(rows, head.tables.get(name) ?? [])
    for (const row of gone)
      out.push(
        weak(path, kind, "case-removed", `${path} > ${name}[${row}]`, {
          row,
        })
      )
  }
  for (const [name, bound] of base.bounds) {
    const now = head.bounds.get(name)
    const looser =
      !now ||
      (bound.direction === "up"
        ? now.value > bound.value
        : now.value < bound.value)
    if (looser)
      out.push(
        weak(
          path,
          kind,
          "bound-loosened",
          `${path} > ${name} ${bound.value} -> ${now ? now.value : "removed"}`
        )
      )
  }
  return out
}

function parseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false }
  }
}

function ratchetRaises(base, head, at, out) {
  if (Array.isArray(base) && Array.isArray(head)) {
    const fresh = minus(
      head.map((v) => JSON.stringify(v)),
      base.map((v) => JSON.stringify(v))
    )
    for (const item of fresh) out.push(`${at}[] gains ${item}`)
    return
  }
  if (typeof base === "number" && typeof head === "number") {
    if (head > base) out.push(`${at} ${base} -> ${head}`)
    return
  }
  if (base && head && typeof base === "object" && typeof head === "object") {
    for (const key of Object.keys(head)) {
      if (!(key in base)) out.push(`${at}.${key} is new`)
      else ratchetRaises(base[key], head[key], `${at}.${key}`, out)
    }
    return
  }
  if (JSON.stringify(base) !== JSON.stringify(head))
    out.push(`${at} changed to ${JSON.stringify(head)}`)
}

function ratchetWeakenings(baseText, headText, path, kind) {
  if (headText === null) return [weak(path, kind, "file-removed", path)]
  const base = parseJson(baseText)
  const head = parseJson(headText)
  if (!base.ok || !head.ok)
    return baseText === headText
      ? []
      : [weak(path, kind, "ratchet-raised", `${path} is not readable JSON`)]
  const raised = []
  ratchetRaises(base.value, head.value, path, raised)
  return raised.map((subject) => weak(path, kind, "ratchet-raised", subject))
}

function ledgerWeakenings(baseText, headText, path, kind) {
  if (headText === null) return [weak(path, kind, "file-removed", path)]
  const base = parseJson(baseText)
  const head = parseJson(headText)
  if (!base.ok || !head.ok)
    return baseText === headText
      ? []
      : [weak(path, kind, "fixture-changed", path)]
  const keys = new Set([
    ...Object.keys(base.value ?? {}),
    ...Object.keys(head.value ?? {}),
  ])
  keys.delete("reason")
  const changed = [...keys].filter(
    (key) =>
      JSON.stringify(base.value?.[key]) !== JSON.stringify(head.value?.[key])
  )
  return changed.map((key) =>
    weak(path, kind, "fixture-changed", `${path} .${key}`)
  )
}

function sourceOf(path, text) {
  return ts.createSourceFile(path, String(text), ts.ScriptTarget.Latest, true)
}

function declarations(path, text) {
  const found = new Map()
  const source = sourceOf(path, text)
  const visit = (node) => {
    if (
      (ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.initializer
    )
      if (!found.has(node.name.text))
        found.set(node.name.text, { node: node.initializer, source })
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

function literalsIn(entry) {
  if (!entry) return []
  const out = []
  const visit = (node) => {
    if (ts.isStringLiteralLike(node) || ts.isRegularExpressionLiteral(node))
      out.push(node.getText(entry.source))
    ts.forEachChild(node, visit)
  }
  visit(entry.node)
  return out
}

function elementsIn(entry) {
  if (!entry) return []
  let node = entry.node
  while (
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node)
  )
    node = node.expression
  if (ts.isArrayLiteralExpression(node))
    return node.elements.map((e) => normalise(e.getText(entry.source)))
  if (ts.isObjectLiteralExpression(node))
    return node.properties.map((p) => normalise(p.getText(entry.source)))
  return literalsIn(entry)
}

function numberIn(entry) {
  if (!entry || !ts.isNumericLiteral(entry.node)) return null
  return Number(entry.node.text.replace(/_/g, ""))
}

function checkerWeakenings(baseText, headText, path, kind) {
  const spec = CHECKER_CONFIG[path] ?? { frozen: true }
  if (headText === null) return [weak(path, kind, "scanner-dropped", path)]
  if (spec.frozen)
    return baseText === headText
      ? []
      : [weak(path, kind, "scanner-dropped", `${path} changed`)]
  const base = declarations(path, baseText)
  const head = declarations(path, headText)
  const out = []
  for (const name of spec.grows ?? [])
    for (const gone of minus(
      literalsIn(base.get(name)),
      literalsIn(head.get(name))
    ))
      out.push(weak(path, kind, "scanner-dropped", `${path} ${name} ${gone}`))
  for (const name of spec.shrinks ?? [])
    for (const fresh of minus(
      elementsIn(head.get(name)),
      elementsIn(base.get(name))
    ))
      out.push(
        weak(path, kind, "ratchet-raised", `${path} ${name} gains ${fresh}`)
      )
  for (const name of spec.floors ?? []) {
    const was = numberIn(base.get(name))
    const now = numberIn(head.get(name))
    if (was !== null && (now === null || now < was))
      out.push(
        weak(path, kind, "bound-loosened", `${path} ${name} ${was} -> ${now}`)
      )
  }
  return out
}

function boundNumbers(path, text) {
  const found = new Map()
  const source = sourceOf(path, text)
  const visit = (node, at) => {
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name))
    ) {
      const name = node.name.text
      const here = [...at, name]
      if (name in BOUND_LOOSER && ts.isNumericLiteral(node.initializer))
        found.set(here.join("."), {
          name,
          value: Number(node.initializer.text.replace(/_/g, "")),
        })
      ts.forEachChild(node, (child) => visit(child, here))
      return
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      ts.forEachChild(node, (child) => visit(child, [...at, node.name.text]))
      return
    }
    ts.forEachChild(node, (child) => visit(child, at))
  }
  visit(source, [])
  return found
}

function boundWeakenings(baseText, headText, path, kind) {
  const base = boundNumbers(path, baseText)
  const head = headText === null ? new Map() : boundNumbers(path, headText)
  const out = []
  for (const [at, was] of base) {
    const now = head.get(at)
    const direction = BOUND_LOOSER[was.name]
    const looser =
      !now ||
      (direction === "up" ? now.value > was.value : now.value < was.value)
    if (looser)
      out.push(
        weak(
          path,
          kind,
          "bound-loosened",
          `${path} ${at} ${was.value} -> ${now ? now.value : "removed"}`
        )
      )
  }
  return out
}

function jsonLosses(base, head, at, out) {
  if (base && head && typeof base === "object" && typeof head === "object") {
    if (Array.isArray(base) !== Array.isArray(head)) {
      out.push(at)
      return
    }
    if (Array.isArray(base) && head.length < base.length) {
      out.push(at)
      return
    }
    for (const key of Object.keys(base)) {
      if (!(key in head)) out.push(`${at}.${key}`)
      else jsonLosses(base[key], head[key], `${at}.${key}`, out)
    }
    return
  }
  if (JSON.stringify(base) !== JSON.stringify(head)) out.push(at)
}

function fileWeakenings(baseText, headText, path, kind) {
  if (headText === null) return [weak(path, kind, "file-removed", path)]
  if (/\.json$/.test(path)) {
    const base = parseJson(baseText)
    const head = parseJson(headText)
    if (base.ok && head.ok) {
      const lost = []
      jsonLosses(base.value, head.value, path, lost)
      return lost.map((at) => weak(path, kind, "fixture-changed", at))
    }
  }
  return baseText === headText
    ? []
    : [weak(path, kind, "fixture-changed", path)]
}

export function weakenings(baseText, headText, path, kind) {
  switch (kind) {
    case "test":
    case "guard":
    case "acceptance":
      return testWeakenings(baseText, headText, path, kind)
    case "ratchet":
      return ratchetWeakenings(baseText, headText, path, kind)
    case "ledger":
      return ledgerWeakenings(baseText, headText, path, kind)
    case "checker-config":
      return checkerWeakenings(baseText, headText, path, kind)
    case "bound":
      return boundWeakenings(baseText, headText, path, kind)
    default:
      return fileWeakenings(baseText, headText, path, kind)
  }
}

export function addedChecks(files) {
  const assertions = []
  const rows = []
  const titles = []
  const blobs = new Set()
  for (const { path, baseText, headText, headBlob } of files) {
    if (headBlob && headText !== null) blobs.add(headBlob)
    if (headText === null || !TEST.test(path)) continue
    const head = parseTests(path, headText)
    const base = baseText === null ? null : parseTests(path, baseText)
    const running = (parsed) =>
      [...parsed.cases.values()].filter(
        (c) => ![...c.marks].some((m) => RUNS_NOTHING.has(m))
      )
    const tableRows = (parsed) => [...parsed.tables.values()].flat()
    for (const item of running(head)) {
      const now = item.assertions.map((a) => a.meaning)
      const was = base?.cases.get(item.key)
      assertions.push(
        ...(was
          ? minus(
              now,
              was.assertions.map((a) => a.meaning)
            )
          : now)
      )
    }
    rows.push(
      ...(base ? minus(tableRows(head), tableRows(base)) : tableRows(head))
    )
    titles.push(
      ...running(head)
        .filter((c) => !base?.cases.has(c.key))
        .map((c) => c.title)
    )
  }
  return { assertions, rows, titles, blobs }
}

function take(pool, items, same = (a, b) => a === b) {
  const left = [...pool]
  for (const item of items) {
    let at = left.indexOf(item)
    if (at === -1) at = left.findIndex((next) => same(item, next))
    if (at === -1) return false
    left.splice(at, 1)
  }
  pool.length = 0
  pool.push(...left)
  return true
}

function keptCase(lost, pools) {
  if (lost.row) return take(pools.rows, [lost.row])
  if (lost.assertions?.length)
    return take(pools.assertions, lost.assertions, tightens)
  return take(pools.titles, [lost.title])
}

export function unmoved(found, added) {
  const pools = {
    assertions: [...added.assertions],
    rows: [...added.rows],
    titles: [...added.titles],
  }
  const out = []
  for (const item of found) {
    if (item.what === "file-removed" && item.moved) {
      if (item.blob && added.blobs.has(item.blob)) continue
      for (const lost of item.moved)
        if (!keptCase(lost, pools))
          out.push(
            weak(
              item.path,
              item.kind,
              "case-removed",
              `${item.path} > ${lost.key}${lost.row ? `[${lost.row}]` : ""}`
            )
          )
      continue
    }
    if (item.what === "file-removed") {
      if (!(item.blob && added.blobs.has(item.blob))) out.push(item)
      continue
    }
    if (item.what === "case-removed" && keptCase(item, pools)) continue
    if (
      item.what === "assertion-removed" &&
      take(pools.assertions, item.assertions, tightens)
    )
      continue
    out.push(item)
  }
  return out.map(
    ({ moved, assertions: _a, row: _r, blob: _b, title: _t, ...rest }) => rest
  )
}

export function retiredBy(item, retirements) {
  return retirements.find(
    (r) =>
      r.subject === item.subject ||
      r.subject === item.path ||
      item.subject.startsWith(`${r.subject} :: `) ||
      item.subject.startsWith(`${r.subject} (.`) ||
      item.subject.startsWith(`${r.subject} > `) ||
      item.subject.startsWith(`${r.subject}[`)
  )
}

export function judge(files, retirements = []) {
  const found = files
    .filter((f) => f.kind && f.baseText !== null)
    .flatMap((f) =>
      weakenings(f.baseText, f.headText, f.path, f.kind).map((item) =>
        item.what === "file-removed" ? { ...item, blob: f.baseBlob } : item
      )
    )
  const left = unmoved(found, addedChecks(files))
  const weakened = []
  const retired = []
  for (const item of left) {
    const by = item.kind === "acceptance" ? null : retiredBy(item, retirements)
    if (by) retired.push({ ...item, retiredBy: by.subject })
    else weakened.push(item)
  }
  return { weakened, retired }
}

export function detect(text) {
  const { files } = JSON.parse(text)
  return judge(
    files.map((file) => ({
      ...file,
      kind: file.baseText === null ? null : (file.kind ?? kindOf(file.path)),
    }))
  ).weakened
}
