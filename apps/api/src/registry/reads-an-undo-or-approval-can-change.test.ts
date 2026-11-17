import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"

import {
  commands,
  queries as queryCatalog,
  type ContractCommandName,
  type QueryName,
} from "@workspace/domain"

const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
)
const domainSrc = path.join(repo, "packages/domain/src")
const apiSrc = path.join(repo, "apps/api/src")

function parse(file: string) {
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
}

function propName(name: ts.PropertyName) {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  )
    return name.text
  return null
}

function returnsOnlyNull(fn: ts.ArrowFunction | ts.FunctionExpression) {
  const body = fn.body
  if (body.kind === ts.SyntaxKind.NullKeyword) return true
  if (!ts.isBlock(body) || body.statements.length !== 1) return false
  const statement = body.statements[0]
  return (
    ts.isReturnStatement(statement) &&
    statement.expression?.kind === ts.SyntaxKind.NullKeyword
  )
}

function constInitializer(sf: ts.SourceFile, name: string) {
  let found: ts.Expression | null = null
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    )
      found = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

function functionNode(sf: ts.SourceFile, name: string) {
  const init = constInitializer(sf, name)
  if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)))
    return init
  let found: ts.FunctionDeclaration | null = null
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

function writesActivity(init: ts.Expression, sf: ts.SourceFile): boolean {
  const target = ts.isIdentifier(init) ? constInitializer(sf, init.text) : init
  if (!target) return true
  if (
    (ts.isArrowFunction(target) || ts.isFunctionExpression(target)) &&
    returnsOnlyNull(target)
  )
    return false
  return true
}

function filesNamed(dir: string, name: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return filesNamed(full, name)
    return entry.name === name ? [full] : []
  })
}

function bindingObjects(sf: ts.SourceFile) {
  const found: ts.ObjectLiteralExpression[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "bindCommands" &&
      node.arguments[2] &&
      ts.isObjectLiteralExpression(node.arguments[2])
    )
      found.push(node.arguments[2])
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

function addedCommands(sf: ts.SourceFile) {
  return selectedCommands(sf, "addCommand")
}

function selectedCommands(sf: ts.SourceFile, method = "addSelectedCommand") {
  const found: Array<{ name: string; activity: ts.Expression }> = []
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === method &&
      node.arguments[0] &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      let name: string | null = null
      let activity: ts.Expression | null = null
      for (const prop of node.arguments[0].properties) {
        if (!ts.isPropertyAssignment(prop)) continue
        const key = propName(prop.name)
        if (key === "name" && ts.isStringLiteral(prop.initializer))
          name = prop.initializer.text
        if (key === "activity") activity = prop.initializer
      }
      if (name && activity) found.push({ name, activity })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

function activityOf(binding: ts.ObjectLiteralExpression) {
  for (const prop of binding.properties) {
    if (!ts.isPropertyAssignment(prop) || propName(prop.name) !== "activity")
      continue
    return prop.initializer
  }
  return null
}

function commandEntries(sf: ts.SourceFile) {
  const found = new Map<string, ts.ObjectLiteralExpression>()
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      propName(node.name) &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "commandEntry" &&
      node.initializer.arguments[0] &&
      ts.isObjectLiteralExpression(node.initializer.arguments[0])
    )
      found.set(propName(node.name)!, node.initializer.arguments[0])
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

function isQueryName(value: string): value is QueryName {
  return Object.hasOwn(queryCatalog, value)
}

function queriesNamedIn(
  node: ts.Node,
  sf: ts.SourceFile,
  seen: Set<string>,
  names: Set<QueryName>
) {
  const visit = (current: ts.Node) => {
    if (ts.isIdentifier(current) && !seen.has(current.text)) {
      const fn = functionNode(sf, current.text)
      if (fn) {
        seen.add(current.text)
        queriesNamedIn(fn, sf, seen, names)
      }
    }
    if (
      ts.isPropertyAssignment(current) &&
      propName(current.name) === "query" &&
      ts.isStringLiteral(current.initializer)
    ) {
      const name = current.initializer.text
      if (!isQueryName(name)) throw new Error(`${name} is not a query name`)
      names.add(name)
    }
    ts.forEachChild(current, visit)
  }
  visit(node)
}

function invalidatesOf(entry: ts.ObjectLiteralExpression) {
  for (const prop of entry.properties) {
    if (ts.isPropertyAssignment(prop) && propName(prop.name) === "invalidates")
      return prop.initializer
  }
  return null
}

function classified() {
  const writes = new Map<string, boolean>()
  for (const file of filesNamed(apiSrc, "commands.ts")) {
    const sf = parse(file)
    for (const bindings of bindingObjects(sf)) {
      for (const prop of bindings.properties) {
        if (!ts.isPropertyAssignment(prop) || !propName(prop.name)) continue
        if (!ts.isObjectLiteralExpression(prop.initializer)) continue
        const name = propName(prop.name)!
        const activity = activityOf(prop.initializer)
        if (!activity) throw new Error(`${name} has no activity binding`)
        if (writes.has(name)) throw new Error(`${name} is bound twice`)
        writes.set(name, writesActivity(activity, sf))
      }
    }
  }
  for (const file of filesNamed(apiSrc, "package-edit.ts")) {
    const sf = parse(file)
    for (const selected of selectedCommands(sf)) {
      if (writes.has(selected.name))
        throw new Error(`${selected.name} is bound twice`)
      writes.set(selected.name, writesActivity(selected.activity, sf))
    }
  }
  for (const file of [
    ...filesNamed(apiSrc, "package-canvas.ts"),
    ...filesNamed(apiSrc, "card-action-commands.ts"),
  ]) {
    const sf = parse(file)
    for (const selected of addedCommands(sf)) {
      if (writes.has(selected.name))
        throw new Error(`${selected.name} is bound twice`)
      writes.set(selected.name, writesActivity(selected.activity, sf))
    }
  }
  for (const file of [
    ...filesNamed(apiSrc, "package-start.ts"),
    ...filesNamed(apiSrc, "rich-coach.ts"),
  ]) {
    const sf = parse(file)
    for (const selected of selectedCommands(sf, "addReviewedCommand")) {
      if (writes.has(selected.name))
        throw new Error(`${selected.name} is bound twice`)
      writes.set(selected.name, writesActivity(selected.activity, sf))
    }
  }

  const entries = new Map<
    string,
    { sf: ts.SourceFile; entry: ts.ObjectLiteralExpression }
  >()
  for (const file of readdirSync(domainSrc)) {
    if (!file.endsWith("-contract.ts")) continue
    const sf = parse(path.join(domainSrc, file))
    for (const [name, entry] of commandEntries(sf))
      entries.set(name, { sf, entry })
  }

  const writers = new Set<ContractCommandName>()
  const queries = new Map<ContractCommandName, QueryName[]>()
  for (const name of Object.keys(commands) as ContractCommandName[]) {
    const pending = commands[name].coach === "confirm"
    if (writes.get(name) || pending) writers.add(name)
    const found = entries.get(name)
    if (!found) continue
    const invalidates = invalidatesOf(found.entry)
    if (!invalidates) continue
    const named = new Set<QueryName>()
    queriesNamedIn(invalidates, found.sf, new Set(), named)
    queries.set(name, [...named].sort())
  }

  const refresh = commands["activity.undo"]
    .invalidates(undefined as never)
    .map((ref) => ref.query)
  const approved = commands["actions.approve"]
    .invalidates(undefined as never)
    .map((ref) => ref.query)

  return { writes, writers, queries, refresh, approved }
}

describe("reads an undo or an approval can change", () => {
  const { writes, writers, queries, refresh, approved } = classified()

  it("approve and undo refresh the same reads", () => {
    expect([...approved].sort()).toEqual([...refresh].sort())
    expect(new Set(refresh).size).toBe(refresh.length)
  })

  it("includes every read a command that writes an activity row or a pending action names", () => {
    const covered = new Set(refresh)
    const missing = [...writers]
      .sort()
      .flatMap((name) =>
        (queries.get(name) ?? []).flatMap((query) =>
          covered.has(query)
            ? []
            : [
                `${name} names ${query} in its invalidates, but readsAnUndoOrApprovalCanChange does not refresh it`,
              ]
        )
      )
    expect(missing).toEqual([])
  })

  it("binds every command and classifies an activity writer, a confirm command, and commands that do neither", () => {
    expect([...writes.keys()].sort()).toEqual(Object.keys(commands).sort())
    expect(writers.has("inbox.snooze")).toBe(true)
    expect(writers.has("job.delete")).toBe(true)
    expect(writers.has("chat.create")).toBe(false)
    expect(writers.has("paper.unshare")).toBe(false)
    expect(writers.has("activity.undo")).toBe(false)
    expect(writers.has("actions.approve")).toBe(false)
    expect(writers.size).toBeGreaterThan(10)
    expect(writers.size).toBeLessThan(Object.keys(commands).length)
  })

  it("keeps the name on both call sites", () => {
    const source = readFileSync(
      path.join(domainSrc, "chat-contract.ts"),
      "utf8"
    )
    expect(source).not.toContain(
      "refreshEveryReadBecauseTheWriteTargetIsUnknown"
    )
    expect(
      source.match(/invalidates: readsAnUndoOrApprovalCanChange,/g)
    ).toHaveLength(2)
  })
})
