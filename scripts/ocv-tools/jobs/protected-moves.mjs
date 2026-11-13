import { posix } from "node:path"
import { minus, RUNS_NOTHING, stillChecks, weak } from "./assertion-match.mjs"
import { exportedTable, parseTests } from "./protected-tests.mjs"

const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/
const CODE = /\.[cm]?[jt]sx?$/

function importedTables(files) {
  const texts = new Map(
    files
      .filter((f) => f.headText !== null && CODE.test(f.path))
      .map((f) => [f.path, f.headText])
  )
  return (from) => (specifier, name) => {
    if (!specifier.startsWith(".")) return null
    const target = posix.join(posix.dirname(from), specifier)
    const stem = target.replace(/\.[cm]?[jt]sx?$/, "")
    for (const path of [
      target,
      ...["mjs", "js", "ts", "tsx"].map((x) => `${stem}.${x}`),
    ])
      if (texts.has(path)) return exportedTable(path, texts.get(path), name)
    return null
  }
}

export function addedChecks(files) {
  const assertions = []
  const rows = []
  const titles = []
  const blobs = new Set()
  const tablesFor = importedTables(files)
  for (const { path, baseText, headText, headBlob } of files) {
    if (headBlob && headText !== null) blobs.add(headBlob)
    if (headText === null || !TEST.test(path)) continue
    const head = parseTests(path, headText, { tableRows: tablesFor(path) })
    const base = baseText === null ? null : parseTests(path, baseText)
    const running = (parsed) =>
      [...parsed.cases.values()].filter(
        (c) => ![...c.marks].some((m) => RUNS_NOTHING.has(m))
      )
    const tableRows = (parsed) => [...parsed.tables.values()].flat()
    for (const item of running(head)) {
      const was = base?.cases.get(item.key)
      const fresh = was
        ? minus(
            item.assertions.map((a) => a.meaning),
            was.assertions.map((a) => a.meaning)
          )
        : item.assertions.map((a) => a.meaning)
      assertions.push(...fresh)
      for (const a of item.assertions)
        if (fresh.includes(a.meaning)) assertions.push(...a.rows)
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

const wide = (a, b) => stillChecks(a, b, true)

function lostOf(path, kind, key, lost, pools) {
  if (lost.row)
    return take(pools.rows, [lost.row])
      ? []
      : [weak(path, kind, "case-removed", `${path} > ${key}[${lost.row}]`)]
  if (!lost.assertions?.length)
    return take(pools.titles, [lost.title])
      ? []
      : [weak(path, kind, "case-removed", `${path} > ${key}`)]
  const gone = lost.assertions.filter(
    (a) => !take(pools.assertions, [a.meaning], wide)
  )
  if (gone.length === lost.assertions.length && lost.whole)
    return [weak(path, kind, "case-removed", `${path} > ${key}`)]
  return gone.map((a) =>
    weak(path, kind, "assertion-removed", `${path} > ${key} :: ${a.text}`)
  )
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
        out.push(
          ...lostOf(
            item.path,
            item.kind,
            lost.key,
            { ...lost, whole: true },
            pools
          )
        )
      continue
    }
    if (item.what === "file-removed") {
      if (!(item.blob && added.blobs.has(item.blob))) out.push(item)
      continue
    }
    if (item.what === "case-removed" && item.row) {
      if (!take(pools.rows, [item.row])) out.push(item)
      continue
    }
    if (item.what === "case-removed") {
      const key = item.subject.slice(item.path.length + 3)
      out.push(
        ...lostOf(item.path, item.kind, key, { ...item, whole: true }, pools)
      )
      continue
    }
    if (
      item.what === "assertion-removed" &&
      take(pools.assertions, [item.assertions[0].meaning], wide)
    )
      continue
    out.push(item)
  }
  return out.map(
    ({ moved, assertions: _a, row: _r, blob: _b, title: _t, ...rest }) => rest
  )
}
