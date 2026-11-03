import ts from "typescript"

export type SourceFile = { name: string; text: string }
export type Finding = { file: string; line: number; call: string }

const COMMAND_RUNNERS = new Set(["runContractCommand", "undoActivity"])
export const LEGACY_MARKER = "rejected-ok:"
const QUIET_WRAPPER = "ignoreRejection"

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

function reachableNameOf(fn: Fn): string | undefined {
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

function hasMarker(
  sf: ts.SourceFile,
  node: ts.Node,
  legacyFiles: ReadonlySet<string>
) {
  if (!legacyFiles.has(sf.fileName)) return false
  const lines = sf.text.split("\n")
  const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line
  const near = [lines[line - 1] ?? "", lines[line] ?? ""].join("\n")
  return near.includes(LEGACY_MARKER)
}

const QUIET_WRAPPER_MODULE = /(?:^@\/lib\/|\/)quiet-rejection(?:\.ts)?$/

function importsQuietWrapper(sf: ts.SourceFile, local: string) {
  return sf.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      QUIET_WRAPPER_MODULE.test(statement.moduleSpecifier.text) &&
      statement.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        (element) =>
          !element.isTypeOnly &&
          (element.propertyName ?? element.name).text === QUIET_WRAPPER &&
          element.name.text === local
      )
  )
}

function isQuietWrapperArgument(node: ts.Node, sf: ts.SourceFile) {
  const parent = node.parent
  return (
    ts.isCallExpression(parent) &&
    ts.isIdentifier(parent.expression) &&
    parent.arguments[0] === node &&
    importsQuietWrapper(sf, parent.expression.text)
  )
}

function argumentOf(node: ts.Node): ts.CallExpression | undefined {
  const parent = node.parent
  return ts.isCallExpression(parent) &&
    parent.arguments.includes(node as ts.Expression)
    ? parent
    : undefined
}

function isNoOpHandler(
  handler: ts.Expression | undefined,
  sf: ts.SourceFile,
  legacyFiles: ReadonlySet<string>
) {
  if (!handler) return true
  if (!ts.isArrowFunction(handler) && !ts.isFunctionExpression(handler)) {
    return false
  }
  const body = handler.body
  if (ts.isBlock(body)) {
    return (
      body.statements.length === 0 &&
      !(
        legacyFiles.has(sf.fileName) && body.getText(sf).includes(LEGACY_MARKER)
      )
    )
  }
  const text = body.getText(sf)
  return text === "undefined" || text === "void 0"
}

type Fate = "handled" | "dropped" | "propagates" | "other"

function fateOf(
  call: ts.CallExpression,
  sf: ts.SourceFile,
  legacyFiles: ReadonlySet<string>
): Fate {
  let node: ts.Node = call
  for (;;) {
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
          return isNoOpHandler(outer.arguments[0], sf, legacyFiles) &&
            !hasMarker(sf, call, legacyFiles)
            ? "dropped"
            : "handled"
        }
        if (name === "then" && outer.arguments.length >= 2) {
          return isNoOpHandler(outer.arguments[1], sf, legacyFiles) &&
            !hasMarker(sf, call, legacyFiles)
            ? "dropped"
            : "handled"
        }
        node = outer
        continue
      }
      break
    }
    while (ts.isParenthesizedExpression(node.parent)) node = node.parent
    if (isQuietWrapperArgument(node, sf)) return "handled"
    const wrapper = argumentOf(node)
    if (!wrapper) break
    node = wrapper
  }
  const parent = node.parent
  if (ts.isAwaitExpression(parent)) {
    for (let n: ts.Node = parent; n.parent && !isFn(n); n = n.parent) {
      const up = n.parent
      if (
        ts.isTryStatement(up) &&
        up.tryBlock === n &&
        up.catchClause &&
        (up.catchClause.block.statements.length > 0 ||
          (legacyFiles.has(sf.fileName) &&
            up.catchClause.block.getText(sf).includes(LEGACY_MARKER)))
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

function isInlineBlockBodyJsxHandlerWithNobodyToCatch(fn: Fn) {
  return (
    ts.isArrowFunction(fn) &&
    ts.isJsxExpression(fn.parent) &&
    ts.isBlock(fn.body)
  )
}

function namesBoundToUseRunCommand(sf: ts.SourceFile) {
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

export function findDroppedRejections(
  files: SourceFile[],
  legacyFiles: ReadonlySet<string> = new Set()
): Finding[] {
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
  const runners = new Map(
    parsed.map(({ sf }) => [sf, namesBoundToUseRunCommand(sf)])
  )
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

  for (let changed = true; changed;) {
    changed = false
    for (const { sf } of parsed) {
      for (const call of calls(sf)) {
        if (fateOf(call, sf, legacyFiles) !== "propagates") continue
        const fn = enclosingFn(call)
        const name = fn && reachableNameOf(fn)
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
      const fate = fateOf(call, sf, legacyFiles)
      const fn = enclosingFn(call)
      const dropped =
        fate === "dropped" ||
        (fate === "propagates" &&
          fn &&
          isInlineBlockBodyJsxHandlerWithNobodyToCatch(fn))
      if (!dropped || hasMarker(sf, call, legacyFiles)) continue
      findings.push({
        file: file.name,
        line: sf.getLineAndCharacterOfPosition(call.getStart(sf)).line + 1,
        call: call.expression.getText(sf),
      })
    }
  }
  return findings
}
