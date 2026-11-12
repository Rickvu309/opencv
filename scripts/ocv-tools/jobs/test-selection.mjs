import { CODE_EXT, add, closureOf, importGraph } from "./import-graph.mjs"
import { isRunnableTest, runnerOf } from "./test-runners.mjs"

export const MAX_PER_RUNNER = 40
export const LOCAL_CAP = 25
const LEFT_OUT_NAMED = 3
const NEAR = 2.5

const api = (path) => new RegExp(`^apps/api/${path}`)
const web = (path) => new RegExp(`^apps/web/${path}`)
const API_SRC = api("src/")
const WEB_SRC = web("src/")
const UI_SRC = /^packages\/ui\/src\//
const DOMAIN_SRC = /^packages\/domain\/src\//
const MIGRATIONS = api("drizzle/")
export const COMMAND_FILES =
  /^apps\/api\/src\/(?:.+\/)?commands?\.ts$|^apps\/api\/src\/registry\//
const CONTRACT = [DOMAIN_SRC, COMMAND_FILES]

export const TREE_SCANS = Object.freeze({
  "apps/api/src/auth-routes.test.ts": [WEB_SRC],
  "apps/api/src/db/migrate.test.ts": [MIGRATIONS],
  "apps/api/src/paper/photo-references.schema.test.ts": [
    MIGRATIONS,
    /^apps\/api\/src\/(?:.+\/)?[^/]*schema[^/]*\.ts$/,
  ],
  "apps/api/src/registry/boundaries.test.ts": [API_SRC],
  "apps/api/src/registry/names.test.ts": [WEB_SRC, DOMAIN_SRC, API_SRC],
  "apps/api/src/registry/ownership.test.ts": [API_SRC],
  "apps/api/src/registry/reads-an-undo-or-approval-can-change.test.ts": [
    DOMAIN_SRC,
    API_SRC,
  ],
  "apps/api/src/registry/catalog.test.ts": CONTRACT,
  "apps/api/src/registry/job-contract.test.ts": CONTRACT,
  "apps/api/src/registry/paper-contract.test.ts": CONTRACT,
  "apps/api/src/registry/transaction.test.ts": CONTRACT,
  "apps/web/src/features/coach/coach-primary-action.test.ts": [WEB_SRC],
  "apps/web/src/features/paper/paper-fixtures.test.ts": [
    web("src/features/paper/"),
  ],
  "apps/web/src/features/paper/paper-print.test.ts": [
    web("src/features/paper/"),
  ],
  "apps/web/src/features/seed/sample-author.test.ts": [WEB_SRC],
  "apps/web/src/test/deploy-config.test.ts": [
    /^\.railway\//,
    /^\.env\.example$/,
    /^apps\/[^/]+\/(?:package\.json|vite\.config\.ts|Dockerfile)$/,
  ],
  "apps/web/src/test/design-vocabulary.test.ts": [WEB_SRC, UI_SRC],
  "apps/web/src/test/disclosure-buttons.test.ts": [WEB_SRC],
  "apps/web/src/test/feature-imports.test.ts": [WEB_SRC],
  "apps/web/src/test/landing-art-rotation.test.ts": [
    web("src/features/landing/"),
  ],
  "apps/web/src/test/landing-button.test.ts": [web("src/features/landing/")],
  "apps/web/src/test/module-isolation.test.ts": [
    WEB_SRC,
    web("vitest\\.config\\.ts$"),
  ],
  "apps/web/src/test/no-use-state.test.ts": [WEB_SRC],
  "apps/web/src/test/page-header-guard.test.ts": [WEB_SRC],
  "apps/web/src/test/rejected-command.test.ts": [WEB_SRC],
  "apps/web/src/test/request-boundary.test.ts": [WEB_SRC],
  "apps/web/src/test/ui-kit-contract.test.ts": [UI_SRC, WEB_SRC],
  "apps/web/src/test/ui-kit-styled.test.ts": [UI_SRC],
  "apps/web/src/test/warm-routes.test.ts": [WEB_SRC],
  "scripts/ocv-tools/brief.test.mjs": [
    /^AGENTS\.md$/,
    /^docs\/agents\/brief-fences\.json$/,
  ],
  "scripts/ocv-tools/rules-doc.test.mjs": [
    /^AGENTS\.md$/,
    /^scripts\/ocv-tools\/rules\//,
  ],
  "scripts/hand-lists.test.mjs": [/^scripts\//],
  "scripts/comment-anchors.test.mjs": [/\.(?:test|spec)\.[cm]?[jt]sx?$/],
})

export const SCANS_THE_TREE = /readdirSync|globSync|import\.meta\.glob/

const COMMAND_NAME = /["'`]([a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9.]*)["'`]/

export function changedCommandNames(changedLines, textOf) {
  const named = new Map()
  for (const [file, lines] of changedLines) {
    const rows = String(textOf(file)).split("\n")
    const names = new Set()
    for (const line of lines)
      for (let at = Math.min(line, rows.length) - 1; at >= 0; at--) {
        const hit = COMMAND_NAME.exec(rows[at])
        if (hit) {
          names.add(hit[1])
          break
        }
      }
    if (names.size) named.set(file, names)
  }
  return named
}

const mentions = (text, name) =>
  ['"', "'", "`"].some((q) => text.includes(`${q}${name}${q}`))

const stemOfTest = (test) => test.replace(/\.(?:test|spec)\.[cm]?[jt]sx?$/, "")

function localSet(own) {
  const always = own.filter((item) => item.rank < 2)
  const near = own.filter((item) => item.rank >= 2 && item.rank <= NEAR)
  return [
    ...always.slice(0, MAX_PER_RUNNER),
    ...near.slice(0, Math.max(0, LOCAL_CAP - always.length)),
  ]
}

function scanHits(test, changed) {
  const patterns = TREE_SCANS[test]
  if (!patterns) return []
  return changed.filter((file) => patterns.some((p) => p.test(file)))
}

export function selectTests({
  changed,
  tests,
  textOf,
  runners,
  changedLines = new Map(),
}) {
  const changedSet = new Set(changed)
  const paths = [...new Set([...tests, ...changed])]
  const graph = importGraph(paths, textOf)
  const runnable = tests.filter((file) => isRunnableTest(file, runners))
  const runnableSet = new Set(runnable)
  const closures = new Map(
    changed.map((file) => [file, closureOf(graph, file)])
  )
  const directReaders = new Map(
    changed.map((file) => [
      file,
      [
        ...(graph.importersOf.get(file) ?? []),
        ...(graph.readersOf.get(file) ?? []),
      ],
    ])
  )
  const reachedBy = new Map()
  for (const [file, closure] of closures)
    for (const test of closure)
      if (runnableSet.has(test)) add(reachedBy, test, file)
  const named = changedCommandNames(changedLines, textOf)
  const picked = []
  for (const test of runnable) {
    const scanned = scanHits(test, changed)
    const text = named.size ? textOf(test) : ""
    const naming = [...named].find(([, names]) =>
      [...names].some((name) => mentions(text, name))
    )
    const beside = changed.find(
      (file) => file !== test && file.replace(CODE_EXT, "") === stemOfTest(test)
    )
    const imported = reachedBy.get(test) ?? []
    const self = changedSet.has(test) ? [test] : []
    const covers = [
      ...new Set([
        ...self,
        ...scanned,
        ...imported,
        ...(naming ? [naming[0]] : []),
        ...(beside ? [beside] : []),
      ]),
    ]
    if (!covers.length) continue
    const direct = imported.find(
      (file) =>
        (graph.importersOf.get(file) ?? []).includes(test) ||
        (graph.readersOf.get(file) ?? []).includes(test)
    )
    const [why, rank] = self.length
      ? ["changed in this branch", 0]
      : scanned.length
        ? [`scans the tree that holds ${scanned[0]}`, 1]
        : naming
          ? [
              `names ${[...naming[1]].find((name) => mentions(text, name))}, a command whose code changed in ${naming[0]}`,
              2,
            ]
          : direct
            ? [`imports ${direct}`, 2.5]
            : beside
              ? [`sits beside ${beside}`, 2.5]
              : [`imports ${imported[0]} through other files`, 3]
    picked.push({ file: test, why, rank, covers })
  }
  const groups = []
  const reach = new Map()
  const wanted = new Map()
  const ranByRunner = new Map()
  const partial = []
  for (const runner of [...runners].sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    const own = picked
      .filter((item) => runnerOf(item.file, runners) === runner)
      .sort((a, b) => a.rank - b.rank || a.file.localeCompare(b.file))
    if (!own.length) continue
    const files = own.length <= MAX_PER_RUNNER ? own : localSet(own)
    const ran = new Set(files.map((item) => item.file))
    for (const item of own)
      for (const file of item.covers) add(wanted, file, item.file)
    for (const item of files)
      for (const file of item.covers) add(reach, file, item.file)
    ranByRunner.set(runner.name, files.length)
    const left = own.filter((item) => !ran.has(item.file))
    if (left.length)
      partial.push({
        runner: runner.name,
        pkg: runner.pkg ?? null,
        ran: files.length,
        reached: own.length,
        leftOut: left.slice(0, LEFT_OUT_NAMED).map((item) => item.file),
      })
    groups.push({
      runner: runner.name,
      files: files.map(({ file, why, rank }) => ({ file, why, rank })),
      dropped: left.map(({ file, why }) => ({ file, why })),
    })
  }
  const testsAtHead = new Set(runnable)
  const notRun = changed.filter(
    (file) => testsAtHead.has(file) && !(reach.get(file) ?? []).includes(file)
  )
  const unrun = new Map()
  for (const [file, list] of wanted) {
    const ranHere = new Set(reach.get(file) ?? [])
    const missing = list.filter((test) => !ranHere.has(test))
    if (missing.length)
      unrun.set(file, {
        total: list.length,
        ran: list.length - missing.length,
        missing,
        runners: [
          ...new Set(missing.map((test) => runnerOf(test, runners).name)),
        ],
      })
  }
  const imports = new Map(
    [...closures].map(([file, closure]) => [
      file,
      closure.filter((test) => runnableSet.has(test)).length,
    ])
  )
  return {
    groups,
    reach,
    ranByRunner,
    notRun,
    unrun,
    partial,
    closures: directReaders,
    imports,
  }
}
