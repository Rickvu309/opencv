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
  const problems = [...found]
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
    if (exports && !exports.has(fn))
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
