import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { homedir } from "node:os"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"
import { formatOutputs, root } from "./catalog.mjs"
import {
  detectConflictProneLayout,
  staleOutputs,
} from "./lib/catalog-freshness.mjs"
import { renderCatalog } from "./lib/operation-catalog.mjs"
import { tempDir } from "./lib/temp-dir.mjs"

const digestLayoutCommit = "019152ccb3f64690ea533fb98efa5f04b4055f57"
const lastDigestLayoutCommit = "2a4ea761c6d56a458a784ed298cb6de9309d2019"

const withOperation = (snapshot, name) => {
  const [namespace, action] = name.split(".")
  const directory = action.replace(
    /[A-Z]/g,
    (letter) => `-${letter.toLowerCase()}`
  )
  const file = `packages/domain/src/operations/${namespace}/${directory}/operation.ts`
  return {
    ...snapshot,
    operations: [
      ...snapshot.operations,
      { file, name, namespace, directory, owner: namespace },
    ],
    servers: [
      ...snapshot.servers,
      {
        file: `apps/api/src/${namespace}/operations/${namespace}/${directory}/server.ts`,
        operation: file,
        namespace,
        directory,
        owner: namespace,
      },
    ],
  }
}

const withoutOperation = (snapshot, name) => {
  const file = snapshot.operations.find(
    (operation) => operation.name === name
  ).file
  return {
    ...snapshot,
    operations: snapshot.operations.filter(
      (operation) => operation.file !== file
    ),
    servers: snapshot.servers.filter((server) => server.operation !== file),
  }
}

const withSchemaEdit = (snapshot, text) => ({
  ...snapshot,
  sources: [
    ...snapshot.sources,
    ["packages/domain/src/paper/schema.ts", `export const edit = ${text}\n`],
  ],
})

const base = [
  "job.priorityCounts",
  "job.setPriority",
  "paper.export",
  "paper.import",
  "paper.read",
].reduce(withOperation, { operations: [], servers: [], sources: [] })

function mergeOutputs(t, ancestor, ours, theirs) {
  const directory = tempDir(t, "catalog-merge-", path.join(homedir(), "tmp"))
  const merged = {}
  const conflicts = []
  const files = new Set([
    ...Object.keys(ancestor),
    ...Object.keys(ours),
    ...Object.keys(theirs),
  ])
  for (const file of files) {
    const sides = [ours[file], ancestor[file], theirs[file]]
    const paths = ["ours", "base", "theirs"].map((side) =>
      path.join(directory, `${side}-${path.basename(file)}`)
    )
    sides.forEach((text, index) => writeFileSync(paths[index], text ?? ""))
    const result = spawnSync("git", ["merge-file", "-p", ...paths], {
      encoding: "utf8",
    })
    if (result.status !== 0) conflicts.push(file)
    else merged[file] = result.stdout
  }
  return { merged, conflicts }
}

const render = (renderer, snapshot) => formatOutputs(renderer(snapshot))

async function digestLayoutRenderer(t) {
  const source = execFileSync(
    "git",
    ["show", `${digestLayoutCommit}:scripts/lib/operation-catalog.mjs`],
    { cwd: root, encoding: "utf8" }
  )
  const typescript = createRequire(path.join(root, "package.json")).resolve(
    "typescript"
  )
  const directory = tempDir(t, "catalog-layout-", path.join(homedir(), "tmp"))
  const file = path.join(directory, "operation-catalog.mjs")
  writeFileSync(
    file,
    source.replace(
      'from "typescript"',
      `from ${JSON.stringify(pathToFileURL(typescript).href)}`
    )
  )
  return (await import(pathToFileURL(file).href)).renderCatalog
}

const scenarios = [
  ["two schema edits", withSchemaEdit(base, "1"), withSchemaEdit(base, "2")],
  [
    "two added operations",
    withOperation(base, "job.archive"),
    withOperation(base, "paper.compare"),
  ],
  [
    "an added operation and a schema edit",
    withOperation(base, "paper.compare"),
    withSchemaEdit(base, "3"),
  ],
  [
    "a removed operation and an added operation",
    withoutOperation(base, "paper.read"),
    withOperation(base, "job.archive"),
  ],
]

const namesOf = (snapshot) =>
  snapshot.operations.map((operation) => operation.name)

const union = (left, right) => {
  const before = namesOf(base)
  const sides = [namesOf(left), namesOf(right)]
  const removed = before.filter((name) =>
    sides.some((names) => !names.includes(name))
  )
  const names = new Set([...before, ...sides.flat()])
  return [...names]
    .filter((name) => !removed.includes(name))
    .reduce(withOperation, {
      operations: [],
      servers: [],
      sources: [...left.sources, ...right.sources],
    })
}

test("two contract changes merge in either order with no conflict and no regenerate", async (t) => {
  const ancestor = await render(renderCatalog, base)
  for (const [label, left, right] of scenarios) {
    const leftOutputs = await render(renderCatalog, left)
    const rightOutputs = await render(renderCatalog, right)
    const expected = await render(renderCatalog, union(left, right))
    for (const [ours, theirs] of [
      [leftOutputs, rightOutputs],
      [rightOutputs, leftOutputs],
    ]) {
      const { merged, conflicts } = mergeOutputs(t, ancestor, ours, theirs)
      assert.deepEqual(conflicts, [], label)
      assert.deepEqual(merged, expected, label)
      assert.deepEqual(staleOutputs(expected, merged), [], label)
    }
  }
})

test("a schema edit leaves the generated catalog byte for byte unchanged", async () => {
  assert.deepEqual(
    await render(renderCatalog, withSchemaEdit(base, "4")),
    await render(renderCatalog, base)
  )
})

test("neighbouring additions conflict and one generate gives a fresh catalog", async (t) => {
  const left = withOperation(base, "job.archive")
  const right = withOperation(base, "job.assign")
  const { conflicts } = mergeOutputs(
    t,
    await render(renderCatalog, base),
    await render(renderCatalog, left),
    await render(renderCatalog, right)
  )
  assert.ok(conflicts.length > 0)
  const regenerated = await render(renderCatalog, union(left, right))
  assert.deepEqual(staleOutputs(regenerated, regenerated), [])
  assert.match(
    regenerated["packages/domain/src/generated/catalog.ts"],
    /"job\.archive": job\$archive,\n {2}"job\.assign": job\$assign,/
  )
})

test("the digest layout from the commit that introduced it conflicts on every scenario", async (t) => {
  const renderer = await digestLayoutRenderer(t)
  const ancestor = await render(renderer, base)
  for (const [label, left, right] of scenarios) {
    const { conflicts } = mergeOutputs(
      t,
      ancestor,
      await render(renderer, left),
      await render(renderer, right)
    )
    assert.ok(
      conflicts.includes("packages/domain/src/generated/catalog.digest"),
      label
    )
    if (label === "two added operations")
      assert.ok(
        conflicts.includes("apps/api/src/registry/generated/catalog.ts"),
        "index aliases renumber every later line"
      )
  }
})

test("the conflict-prone layout fires on the digest commit and stays quiet on the committed and rendered catalogs", async () => {
  const file = "packages/domain/src/generated/catalog.ts"
  const details = (sha) =>
    new Set(
      detectConflictProneLayout(
        execFileSync("git", ["show", `${sha}:${file}`], {
          cwd: root,
          encoding: "utf8",
        }),
        file
      ).map((problem) => problem.detail)
    )
  assert.equal(details(digestLayoutCommit).size, 1)
  assert.equal(details(lastDigestLayoutCommit).size, 2)
  for (const generated of [file, "apps/api/src/registry/generated/catalog.ts"])
    assert.deepEqual(
      detectConflictProneLayout(
        readFileSync(path.join(root, generated), "utf8"),
        generated
      ),
      []
    )
  for (const [generated, text] of Object.entries(
    await render(renderCatalog, withOperation(base, "job.archive"))
  ))
    assert.deepEqual(detectConflictProneLayout(text, generated), [])
})
