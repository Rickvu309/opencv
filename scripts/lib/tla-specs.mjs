import { dirname, posix } from "node:path"
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

function mapProblems(mapPath, mapText, tlaText, files, read) {
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
  const problems = []
  const modulePath = posix.join(dirname(mapPath), map.module)
  const exports = files.includes(modulePath)
    ? exportedNames(read(modulePath), modulePath)
    : null
  if (!exports) problems.push(`${mapPath}: module ${modulePath} not found`)
  for (const [action, fn] of Object.entries(map.actions)) {
    if (exports && !exports.has(fn))
      problems.push(
        `${mapPath}: ${action} names ${fn}, which ${modulePath} does not export`
      )
    if (!definesAction(tlaText, action))
      problems.push(`${mapPath}: ${action} is not defined in the .tla`)
  }
  return problems
}

export function specProblems(files, read) {
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
        ...mapProblems(mapPath, read(mapPath), read(tla), files, read)
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
