import ts from "typescript"

// Finds code that runs a contract command and drops the rejection, so the
// server turning an edit down shows the user nothing. A call is dropped when
// its promise ends in `void`, a bare statement or a JSX event handler with no
// real `.catch`, and when an awaited call sits outside a try with a real catch
// in a function nobody handles. Write `rejected-ok: <why>` on the call's line,
// the line above it, or inside the empty catch, for a failure that is meant to
// stay quiet.

export type SourceFile = { name: string; text: string }
export type Finding = { file: string; line: number; call: string }

const COMMAND_RUNNERS = new Set(["runContractCommand", "undoActivity"])
const MARKER = "rejected-ok:"

type Fn =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration

function isFn(node: ts.Node): node is Fn {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  )
}

function enclosingFn(node: ts.Node): Fn | undefined {
  for (let n = node.parent; n; n = n.parent) if (isFn(n)) return n
  return undefined
}

/** The name a function is reachable by: its declaration, a `const f = ...`, or `useCallback(...)`. */
function fnName(fn: Fn): string | undefined {
  if ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name) {
    return fn.name.getText()
  }
  let holder: ts.Node = fn
  const parent = fn.parent
  if (
    ts.isCallExpression(parent) &&
    ts.isIdentifier(parent.expression) &&
    parent.expression.text === "useCallback"
  ) {
    holder = parent
  }
  const decl = holder.parent
  if (ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name)) {
    return decl.name.text
  }
  return undefined
}

function isExported(fn: Fn): boolean {
  let n: ts.Node | undefined = fn
  while (n && !ts.isSourceFile(n)) {
    if (ts.isVariableStatement(n) || ts.isFunctionDeclaration(n)) {
      return !!ts
        .getModifiers(n as ts.HasModifiers)
        ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    }
    n = n.parent
  }
  return false
}

function hasMarker(sf: ts.SourceFile, node: ts.Node, extra?: ts.Node) {
  const lines = sf.text.split("\n")
  const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line
  const near = [lines[line - 1] ?? "", lines[line] ?? ""].join("\n")
  return near.includes(MARKER) || (extra?.getText(sf) ?? "").includes(MARKER)
}

/** A handler that does nothing: no argument, an empty body, or `undefined`. */
function swallows(handler: ts.Expression | undefined, sf: ts.SourceFile) {
  if (!handler) return true
  if (!ts.isArrowFunction(handler) && !ts.isFunctionExpression(handler)) {
    return false
  }
  const body = handler.body
  if (ts.isBlock(body)) {
    return body.statements.length === 0 && !body.getText(sf).includes(MARKER)
  }
  const text = body.getText(sf)
  return text === "undefined" || text === "void 0"
}

type Fate = "handled" | "dropped" | "propagates" | "other"

function fateOf(call: ts.CallExpression, sf: ts.SourceFile): Fate {
  let node: ts.Node = call
  // Walk the `.then(...).catch(...).finally(...)` chain this call starts.
  for (;;) {
    const access = node.parent
    if (
      ts.isPropertyAccessExpression(access) &&
      access.expression === node &&
      ts.isCallExpression(access.parent) &&
      access.parent.expression === access
    ) {
      const outer = access.parent
      const name = access.name.text
      if (name === "catch") {
        return swallows(outer.arguments[0], sf) && !hasMarker(sf, call)
          ? "dropped"
          : "handled"
      }
      if (name === "then" && outer.arguments.length >= 2) {
        return swallows(outer.arguments[1], sf) && !hasMarker(sf, call)
          ? "dropped"
          : "handled"
      }
      node = outer
      continue
    }
    break
  }
  while (ts.isParenthesizedExpression(node.parent)) node = node.parent
  const parent = node.parent
  if (ts.isAwaitExpression(parent)) {
    for (let n: ts.Node = parent; n.parent && !isFn(n); n = n.parent) {
      const up = n.parent
      if (
        ts.isTryStatement(up) &&
        up.tryBlock === n &&
        up.catchClause &&
        (up.catchClause.block.statements.length > 0 ||
          up.catchClause.block.getText(sf).includes(MARKER))
      ) {
        return "handled"
      }
    }
    return "propagates"
  }
  if (ts.isVoidExpression(parent) || ts.isExpressionStatement(parent)) {
    return "dropped"
  }
  if (ts.isReturnStatement(parent)) return "propagates"
  if (ts.isArrowFunction(parent) && parent.body === node) return "propagates"
  return "other"
}

function jsxHandler(fn: Fn) {
  // An inline `async () => { await ... }` handler has nobody to catch it. An
  // expression body hands the promise to the component, which may.
  return (
    ts.isArrowFunction(fn) &&
    ts.isJsxExpression(fn.parent) &&
    ts.isBlock(fn.body)
  )
}

/** Names bound to `useRunCommand()` in this file. */
function runnerNames(sf: ts.SourceFile) {
  const names = new Set<string>()
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      node.initializer.expression.getText(sf) === "useRunCommand"
    ) {
      names.add(node.name.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return names
}

export function findDroppedRejections(files: SourceFile[]): Finding[] {
  const parsed = files.map((file) => ({
    file,
    sf: ts.createSourceFile(
      file.name,
      file.text,
      ts.ScriptTarget.Latest,
      true,
      file.name.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    ),
  }))
  const runners = new Map(parsed.map(({ sf }) => [sf, runnerNames(sf)]))
  const exportedRejecting = new Set<string>()
  const localRejecting = new Map(
    parsed.map(({ sf }) => [sf, new Set<string>()])
  )

  function calls(sf: ts.SourceFile): ts.CallExpression[] {
    const out: ts.CallExpression[] = []
    const local = localRejecting.get(sf)!
    const own = runners.get(sf)!
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text
        if (
          COMMAND_RUNNERS.has(name) ||
          own.has(name) ||
          local.has(name) ||
          exportedRejecting.has(name)
        ) {
          out.push(node)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
    return out
  }

  // Grow the set of functions that hand a command's rejection to their caller.
  for (let changed = true; changed;) {
    changed = false
    for (const { sf } of parsed) {
      for (const call of calls(sf)) {
        if (fateOf(call, sf) !== "propagates") continue
        const fn = enclosingFn(call)
        const name = fn && fnName(fn)
        if (!fn || !name) continue
        const local = localRejecting.get(sf)!
        if (!local.has(name)) {
          local.add(name)
          changed = true
        }
        if (isExported(fn) && !exportedRejecting.has(name)) {
          exportedRejecting.add(name)
          changed = true
        }
      }
    }
  }

  const findings: Finding[] = []
  for (const { file, sf } of parsed) {
    for (const call of calls(sf)) {
      const fate = fateOf(call, sf)
      const fn = enclosingFn(call)
      const dropped =
        fate === "dropped" || (fate === "propagates" && fn && jsxHandler(fn))
      if (!dropped || hasMarker(sf, call)) continue
      findings.push({
        file: file.name,
        line: sf.getLineAndCharacterOfPosition(call.getStart(sf)).line + 1,
        call: call.expression.getText(sf),
      })
    }
  }
  return findings
}
