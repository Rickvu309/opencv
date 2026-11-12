import { existsSync, readFileSync } from "node:fs"
import { dirname, join, posix } from "node:path"
import ts from "typescript"

const MUTANT_SUFFIX = ".mutant.cfg"

export function specName(tlaPath) {
  return posix.basename(tlaPath, ".tla")
}

export function ownConfigs(tlaPath, files) {
  const dir = posix.dirname(tlaPath)
  const name = specName(tlaPath)
  const own = new RegExp(`^${name.replace(/\W/g, "\\$&")}(\\..+)?\\.cfg$`)
  return files
    .filter((file) => posix.dirname(file) === dir)
    .filter((file) => own.test(posix.basename(file)))
    .filter((file) => !file.endsWith(MUTANT_SUFFIX))
    .sort()
}

export function mutantOf(cfgPath) {
  return cfgPath.replace(/\.cfg$/, MUTANT_SUFFIX)
}

export const DEFAULT_MUTANT_EXIT = 12
const MUTANT_EXITS = new Set([12, 13])

export function mutantKey(tlaPath, cfgPath) {
  const name = specName(tlaPath)
  const base = posix.basename(cfgPath, ".cfg")
  return base === name ? "" : base.slice(name.length + 1)
}

export function expectedMutantExit(mapText, tlaPath, cfgPath) {
  if (mapText === undefined) return DEFAULT_MUTANT_EXIT
  let map
  try {
    map = JSON.parse(mapText)
  } catch {
    return DEFAULT_MUTANT_EXIT
  }
  return map?.mutants?.[mutantKey(tlaPath, cfgPath)] ?? DEFAULT_MUTANT_EXIT
}

export function exportedNames(sourceText, fileName) {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  )
  const names = new Set()
  const exported = (node) =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    )
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause) {
      if (ts.isNamedExports(statement.exportClause))
        for (const element of statement.exportClause.elements)
          names.add(element.name.text)
      continue
    }
    if (!exported(statement)) continue
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text)
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement)) &&
      statement.name
    )
      names.add(statement.name.text)
  }
  return names
}

const definesAction = (tlaText, action) =>
  new RegExp(`^${action.replace(/\W/g, "\\$&")}\\b[^\\n]*==`, "m").test(tlaText)

function withoutParentheses(text) {
  let depth = 0
  let kept = ""
  for (const char of text) {
    if (char === "(") depth += 1
    else if (char === ")") depth = Math.max(0, depth - 1)
    else if (depth === 0) kept += char
  }
  return kept
}

function nextBody(tlaText) {
  const lines = tlaText.split("\n")
  const start = lines.findIndex((line) => /^Next\b[^\n]*==/.test(line))
  if (start === -1) return ""
  const body = [lines[start].replace(/^[^=]*==/, "")]
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== "" && !/^\s/.test(line)) break
    body.push(line)
  }
  return withoutParentheses(body.join("\n"))
}

export function nextActions(tlaText) {
  const names = []
  for (const part of nextBody(tlaText).split("\\/")) {
    const name = /^\s*(?:\\E[^:]*:\s*)?([A-Za-z_]\w*)/.exec(part)?.[1]
    if (name && definesAction(tlaText, name) && !names.includes(name))
      names.push(name)
  }
  return names
}

export function packageResolver(
  root,
  { exists = existsSync, readFile = readFileSync } = {}
) {
  return (fromDir, specifier) => {
    const parts = specifier.split("/")
    const name = parts.slice(0, specifier.startsWith("@") ? 2 : 1).join("/")
    const inner = parts.slice(name.split("/").length).join("/")
    let dir = join(root, fromDir)
    for (;;) {
      const packageDir = join(dir, "node_modules", name)
      const manifest = join(packageDir, "package.json")
      if (exists(manifest)) {
        const version = JSON.parse(readFile(manifest, "utf8")).version
        const file = join(packageDir, inner)
        return {
          version,
          text: inner && exists(file) ? readFile(file, "utf8") : null,
        }
      }
      const parent = dirname(dir)
      if (parent === dir) return null
      dir = parent
    }
  }
}

function moduleExports(map, mapPath, files, read, installed) {
  if (map.version === undefined) {
    const modulePath = posix.join(dirname(mapPath), map.module)
    return {
      label: modulePath,
      problems: [],
      exports: files.includes(modulePath)
        ? exportedNames(read(modulePath), modulePath)
        : null,
    }
  }
  const found = installed(dirname(mapPath), map.module)
  const problems = []
  if (!found)
    problems.push(`${mapPath}: package of ${map.module} not installed`)
  else if (found.version !== map.version)
    problems.push(
      `${mapPath}: ${map.module} is pinned to ${map.version} but ${found.version} is installed; rerun the harness and recheck the spec, then update "version"`
    )
  return {
    label: map.module,
    problems,
    exports: found?.text ? exportedNames(found.text, map.module) : null,
  }
}

const SYNC_COMMIT = /^[0-9a-f]{40}$/

export function coverageProblems(mapPath, map, files) {
  const problems = []
  if (
    !Array.isArray(map.covers) ||
    map.covers.length === 0 ||
    map.covers.some((path) => typeof path !== "string")
  )
    problems.push(
      `${mapPath}: needs "covers", the repo paths of the code this model describes`
    )
  else
    for (const path of map.covers)
      if (!files.includes(path))
        problems.push(`${mapPath}: covers ${path}, which is not in the repo`)
  if (typeof map.sync !== "string" || !SYNC_COMMIT.test(map.sync))
    problems.push(
      `${mapPath}: needs "sync", the full commit where the model last matched the code`
    )
  if (map.retiring !== undefined && typeof map.retiring !== "string")
    problems.push(`${mapPath}: "retiring" names what replaced the covered code`)
  return problems
}

export function declaredNames(sourceText, fileName) {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  )
  const names = new Set()
  const visit = (node) => {
    if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.name
    )
      names.add(node.name.text)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name))
      names.add(node.name.text)
    if (ts.isClassDeclaration(node) && node.name)
      for (const member of node.members)
        if (
          ts.isMethodDeclaration(member) &&
          member.name &&
          (ts.isIdentifier(member.name) || ts.isPrivateIdentifier(member.name))
        )
          names.add(`${node.name.text}.${member.name.text}`)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return names
}

export function boundaryProblems(mapPath, map, files, read) {
  if (map.boundaries === undefined) return []
  if (!map.boundaries || typeof map.boundaries !== "object")
    return [`${mapPath}: "boundaries" maps an action to "file:name" entries`]
  const problems = []
  const dir = posix.dirname(mapPath)
  const covers = Array.isArray(map.covers) ? map.covers : []
  for (const [action, entries] of Object.entries(map.boundaries)) {
    if (!map.actions || !(action in map.actions))
      problems.push(
        `${mapPath}: boundary ${action} is not an action in "actions"`
      )
    if (!Array.isArray(entries) || entries.length === 0) {
      problems.push(`${mapPath}: boundary ${action} needs "file:name" entries`)
      continue
    }
    for (const entry of entries) {
      const at = typeof entry === "string" ? entry.lastIndexOf(":") : -1
      if (at <= 0 || at === entry.length - 1) {
        problems.push(
          `${mapPath}: boundary ${action} entry ${String(entry)} is not "file:name"`
        )
        continue
      }
      const path = posix.normalize(posix.join(dir, entry.slice(0, at)))
      const name = entry.slice(at + 1)
      if (!files.includes(path)) {
        problems.push(
          `${mapPath}: boundary ${action} names ${path}, which is not in the repo`
        )
        continue
      }
      if (!covers.includes(path))
        problems.push(
          `${mapPath}: boundary ${action} names ${path}, which "covers" must list so --stale watches it`
        )
      const text = read(path)
      if (!text || !declaredNames(text, path).has(name))
        problems.push(
          `${mapPath}: boundary ${action} names ${name}, which ${path} does not define`
        )
    }
  }
  return problems
}

function mapProblems(mapPath, mapText, tlaText, files, read, installed) {
  let map
  try {
    map = JSON.parse(mapText)
  } catch {
    return [`${mapPath}: not valid JSON`]
  }
  if (typeof map?.module !== "string")
    return [`${mapPath}: needs a "module" path next to it`]
  if (!map.actions || typeof map.actions !== "object")
    return [`${mapPath}: needs an "actions" object of Action to function`]
  if (Object.keys(map.actions).length === 0)
    return [`${mapPath}: "actions" is empty; map every action of Next`]
  const {
    label,
    exports,
    problems: found,
  } = moduleExports(map, mapPath, files, read, installed)
  const problems = [
    ...found,
    ...coverageProblems(mapPath, map, files),
    ...boundaryProblems(mapPath, map, files, read),
  ]
  for (const [key, code] of Object.entries(map.mutants ?? {}))
    if (!MUTANT_EXITS.has(code))
      problems.push(
        `${mapPath}: mutant ${key} expects ${code}, which must be 12 (invariant) or 13 (liveness)`
      )
  for (const action of nextActions(tlaText))
    if (!(action in map.actions))
      problems.push(
        `${mapPath}: ${action} is an action of Next but has no entry in "actions"`
      )
  if (!exports && found.length === 0)
    problems.push(`${mapPath}: module ${label} not found`)
  for (const [action, fn] of Object.entries(map.actions)) {
    if (fn !== null && exports && !exports.has(fn))
      problems.push(
        `${mapPath}: ${action} names ${fn}, which ${label} does not export; point at the file that defines it, since "export *" is not followed`
      )
    if (!definesAction(tlaText, action))
      problems.push(`${mapPath}: ${action} is not defined in the .tla`)
  }
  return problems
}

export function specProblems(files, read, installed = () => null) {
  const problems = []
  for (const tla of files.filter((file) => file.endsWith(".tla")).sort()) {
    const name = specName(tla)
    const dir = posix.dirname(tla)
    const sibling = (suffix) => posix.join(dir, `${name}${suffix}`)
    const configs = ownConfigs(tla, files)
    if (!files.includes(sibling(".cfg")))
      problems.push(`${tla}: no ${sibling(".cfg")}`)
    const mapPath = sibling(".tla.json")
    if (!files.includes(mapPath)) problems.push(`${tla}: no ${mapPath}`)
    else
      problems.push(
        ...mapProblems(
          mapPath,
          read(mapPath),
          read(tla),
          files,
          read,
          installed
        )
      )
    for (const cfg of configs)
      if (!files.includes(mutantOf(cfg)))
        problems.push(`${cfg}: no ${mutantOf(cfg)}`)
    for (const mutant of files.filter(
      (file) =>
        posix.dirname(file) === dir &&
        file.endsWith(MUTANT_SUFFIX) &&
        posix.basename(file).startsWith(`${name}.`)
    ))
      if (!configs.includes(mutant.replace(MUTANT_SUFFIX, ".cfg")))
        problems.push(`${mutant}: no ${mutant.replace(MUTANT_SUFFIX, ".cfg")}`)
  }
  return problems
}

export function staleReport(maps, commitsSince) {
  return maps.map(({ tla, map }) => ({
    tla,
    sync: map.sync,
    covers: map.covers,
    retiring: map.retiring ?? null,
    commits: commitsSince(map.sync, map.covers),
  }))
}

export function staleLines(report) {
  const lines = []
  for (const entry of report) {
    const since = entry.sync.slice(0, 8)
    lines.push(
      entry.commits.length === 0
        ? `FRESH ${entry.tla} since ${since}`
        : `STALE ${entry.tla} since ${since}: ${entry.commits.length} commit(s) touch ${entry.covers.join(", ")}`
    )
    for (const commit of entry.commits) lines.push(`  ${commit}`)
    if (entry.retiring) lines.push(`  retiring: ${entry.retiring}`)
  }
  return lines
}
