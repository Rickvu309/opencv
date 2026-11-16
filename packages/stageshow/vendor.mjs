import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  copyFileSync,
} from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { parseArgs } from "node:util"
import { fileURLToPath } from "node:url"

const { values } = parseArgs({
  options: {
    repo: {
      type: "string",
      default: fileURLToPath(new URL("../..", import.meta.url)),
    },
    kit: { type: "string" },
    out: { type: "string" },
    scenes: { type: "string" },
    "scene-out": { type: "string" },
    drop: { type: "string", default: "" },
    "scene-prefix": { type: "string", default: "" },
  },
})

const repo = path.resolve(values.repo)
const require = createRequire(path.join(repo, "package.json"))
const ts = require("typescript")
const { stripComments } = await import(
  path.join(repo, "scripts/lib/strip-comments.mjs")
)

const kit = path.resolve(values.kit)
const out = path.resolve(values.out)
const sceneOut = path.resolve(values["scene-out"])
const dropped = values.drop.split(",").filter(Boolean)

const sourceOf = (file) =>
  ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )

function resolveModule(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec)
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ])
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  throw new Error(`cannot resolve ${spec} from ${fromFile}`)
}

const isBarrel = (file) => {
  if (!/\.tsx?$/.test(file)) return false
  return sourceOf(file).statements.every(
    (s) => ts.isExportDeclaration(s) && s.moduleSpecifier
  )
}

function definingModule(barrel, name) {
  for (const s of sourceOf(barrel).statements) {
    if (!s.exportClause || !ts.isNamedExports(s.exportClause)) continue
    for (const el of s.exportClause.elements) {
      if (el.name.text !== name) continue
      const target = resolveModule(barrel, s.moduleSpecifier.text)
      const original = (el.propertyName ?? el.name).text
      return isBarrel(target)
        ? definingModule(target, original)
        : { file: target, name: original }
    }
  }
  throw new Error(`${name} not exported by ${barrel}`)
}

const vendored = new Set()
const queue = []
const outPath = (file) => path.join(out, path.relative(kit, file))
const relSpec = (fromOut, toOut) => {
  let r = path.relative(path.dirname(fromOut), toOut).split(path.sep).join("/")
  return r.startsWith(".") ? r : `./${r}`
}
const enqueue = (file) => {
  if (!vendored.has(file)) {
    vendored.add(file)
    queue.push(file)
  }
}

function rewriteImports(file, text, fileOut, isScene = false) {
  const specFor = (to) =>
    isScene && values["scene-prefix"]
      ? values["scene-prefix"] +
        path.relative(out, to).split(path.sep).join("/")
      : relSpec(fileOut, to)
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const edits = []
  for (const s of sf.statements) {
    const spec =
      (ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) &&
      s.moduleSpecifier &&
      ts.isStringLiteral(s.moduleSpecifier)
        ? s.moduleSpecifier.text
        : null
    if (!spec || !spec.startsWith(".")) continue
    if (dropped.some((d) => spec.endsWith(d))) {
      edits.push({ start: s.getStart(sf), end: s.getEnd(), text: "" })
      continue
    }
    const target = resolveModule(file, spec)
    const inKit = target.startsWith(kit + path.sep)
    if (!inKit) {
      edits.push({
        start: s.moduleSpecifier.getStart(sf),
        end: s.moduleSpecifier.getEnd(),
        text: JSON.stringify(spec),
      })
      continue
    }
    if (
      isBarrel(target) &&
      ts.isImportDeclaration(s) &&
      s.importClause?.namedBindings &&
      ts.isNamedImports(s.importClause.namedBindings)
    ) {
      const groups = new Map()
      const wholeType = s.importClause.isTypeOnly
      for (const el of s.importClause.namedBindings.elements) {
        const def = definingModule(target, (el.propertyName ?? el.name).text)
        enqueue(def.file)
        const key = def.file
        if (!groups.has(key)) groups.set(key, [])
        const local = el.name.text
        const piece = def.name === local ? def.name : `${def.name} as ${local}`
        groups
          .get(key)
          .push((wholeType || el.isTypeOnly ? "type " : "") + piece)
      }
      const lines = [...groups].map(([def, names]) => {
        const allTypes = names.every((n) => n.startsWith("type "))
        const list = allTypes ? names.map((n) => n.slice(5)) : names
        return `import ${allTypes ? "type " : ""}{ ${list.join(", ")} } from ${JSON.stringify(specFor(outPath(def)))}`
      })
      edits.push({
        start: s.getStart(sf),
        end: s.getEnd(),
        text: lines.join("\n"),
      })
      continue
    }
    if (isBarrel(target))
      throw new Error(`unsupported barrel use in ${file}: ${s.getText(sf)}`)
    enqueue(target)
    edits.push({
      start: s.moduleSpecifier.getStart(sf),
      end: s.moduleSpecifier.getEnd(),
      text: JSON.stringify(specFor(outPath(target))),
    })
  }
  let next = text
  for (const e of edits.sort((a, b) => b.start - a.start))
    next = next.slice(0, e.start) + e.text + next.slice(e.end)
  return next
}

const write = (file, text) => {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
}

const scenes = values.scenes
  .split(",")
  .filter(Boolean)
  .map((d) => path.resolve(d))
for (const dir of scenes) {
  const name = path.basename(dir)
  for (const entry of readdirSync(dir)) {
    const file = path.join(dir, entry)
    if (!/\.(tsx?|css)$/.test(entry)) continue
    const target = path.join(sceneOut, name, entry)
    const text = readFileSync(file, "utf8")
    if (entry.endsWith(".css")) write(target, stripComments(target, text))
    else {
      const swapped = text.replace(
        /(["'])(\.\.\/)+kit\1/g,
        (m, q) => `${q}${path.relative(dir, kit).split(path.sep).join("/")}${q}`
      )
      write(
        target,
        stripComments(target, rewriteImports(file, swapped, target, true))
      )
    }
  }
}

while (queue.length) {
  const file = queue.shift()
  const target = outPath(file)
  if (/\.(tsx?)$/.test(file))
    write(
      target,
      stripComments(
        target,
        rewriteImports(file, readFileSync(file, "utf8"), target)
      )
    )
  else if (file.endsWith(".css"))
    write(target, stripComments(target, readFileSync(file, "utf8")))
  else {
    mkdirSync(path.dirname(target), { recursive: true })
    copyFileSync(file, target)
  }
}

console.log(
  JSON.stringify({
    kitFiles: [...vendored].map((f) => path.relative(kit, f)).sort(),
  })
)
