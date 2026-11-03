import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import ts from "typescript"
import { createPathOps } from "./anchor-paths.mjs"
import {
  KEEPS_TEXT,
  PATH_OPS,
  SEARCH,
  UNKNOWN,
  importTables,
  isNegated,
  literalNode,
  mergeText,
  paramNames,
} from "./anchor-syntax.mjs"
import { judge } from "./comment-spans.mjs"

function scriptKind(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX
  if (/\.(?:[cm]?ts)$/.test(file)) return ts.ScriptKind.TS
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX
  return ts.ScriptKind.JS
}

export const root = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../.."
)

const TEST_FILE = /\.test\.(?:tsx?|mjs)$/
const SCOPE =
  /^(?:apps\/[^/]+\/src\/|packages\/[^/]+\/src\/|scripts\/|\.claude\/skills\/)/

export function isScopedTest(file) {
  return TEST_FILE.test(file) && SCOPE.test(file)
}

function absOf(rel) {
  const abs = path.resolve(root, rel === "." ? "" : rel)
  if (abs !== root && !abs.startsWith(root + path.sep)) return null
  return abs
}

function defaultRead(rel) {
  const abs = absOf(rel)
  if (!abs) return null
  try {
    return readFileSync(abs, "utf8")
  } catch {
    return null
  }
}

function defaultExists(rel) {
  const abs = absOf(rel)
  return abs !== null && existsSync(abs)
}

export function detect(text, file, io = {}) {
  if (!isScopedTest(file)) return []
  const read = io.read ?? defaultRead
  const exists = io.exists ?? defaultExists
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file)
  )
  const { pathNs, pathFns, urlFns } = importTables(sourceFile)
  const frames = [new Map()]
  const active = new Set()
  const hits = new Set()
  const testUrl = pathToFileURL(path.join(root, file)).href
  let pathOps

  for (const name of pathNs) frames[0].set(name, { kind: "pathmod" })
  for (const [name, op] of pathFns) frames[0].set(name, { kind: "pathfn", op })
  for (const [name, op] of urlFns) frames[0].set(name, { kind: "urlfn", op })

  function lookup(name) {
    for (let i = frames.length - 1; i >= 0; i--) {
      if (frames[i].has(name)) return frames[i].get(name)
    }
    return null
  }

  function bind(name, value) {
    frames[frames.length - 1].set(name, value)
  }

  function evalList(nodes) {
    if (!nodes || nodes.some((node) => ts.isSpreadElement(node))) return null
    return nodes.map((node) => evalExpr(node))
  }

  function textFiles(value) {
    if (!value) return null
    if (value.kind === "text") return value.files
    if (value.kind === "expect") return textFiles(value.inner)
    return null
  }

  function addHit(line, method, literal, reason, files) {
    hits.add(
      `${file}:${line}: ${method}(${JSON.stringify(literal)}) ${reason} in ${files.join(", ")}`
    )
  }

  function considerSearch(node, name, recv) {
    const files = textFiles(recv)
    if (!files || files.length === 0) return
    if (recv.kind === "expect" && recv.negated) return
    if (isNegated(node)) return
    for (const lit of node.arguments) {
      const literal = literalNode(lit)
      if (!literal || literal.text.length === 0) continue
      const reason = judge(files, literal.text, read)
      if (!reason) continue
      const line =
        sourceFile.getLineAndCharacterOfPosition(literal.getStart(sourceFile))
          .line + 1
      addHit(line, name, literal.text, reason, files)
    }
  }

  function evalNew(node) {
    if (!ts.isIdentifier(node.expression) || node.expression.text !== "URL")
      return UNKNOWN
    const args = evalList(node.arguments ?? [])
    if (!args || args[0]?.kind !== "str") return UNKNOWN
    let href = null
    if (args[1]?.kind === "url") href = args[1].href
    else if (args[1]?.kind === "str") href = args[1].value
    else if (args[1]?.kind === "path")
      href = pathToFileURL(
        path.join(root, args[1].path === "." ? "" : args[1].path)
      ).href
    if (!href) return UNKNOWN
    try {
      const rel = pathOps.relativeToRoot(
        fileURLToPath(new URL(args[0].value, href))
      )
      return rel === null ? UNKNOWN : pathOps.pathValue(rel)
    } catch {
      return UNKNOWN
    }
  }

  function evalFunction(node) {
    const fn = {
      kind: "fn",
      node,
      params: paramNames(node),
      body: node.body,
      frames: frames.slice(),
    }
    walkFunction(node)
    return fn
  }

  function walkFunction(node) {
    if (!node.body || active.has(node)) return
    active.add(node)
    frames.push(new Map(paramNames(node).map((name) => [name, UNKNOWN])))
    if (ts.isBlock(node.body)) walkBlock(node.body)
    else evalExpr(node.body)
    frames.pop()
    active.delete(node)
  }

  function callFn(fn, argNodes) {
    if (active.has(fn.node)) return UNKNOWN
    const args = evalList(argNodes)
    if (!args) return UNKNOWN
    active.add(fn.node)
    const saved = frames.splice(0, frames.length, ...fn.frames, new Map())
    fn.params.forEach((name, index) => {
      frames[frames.length - 1].set(name, args[index] ?? UNKNOWN)
    })
    let result = UNKNOWN
    if (fn.body && ts.isBlock(fn.body)) result = execBlock(fn.body)
    else if (fn.body) result = evalExpr(fn.body)
    frames.splice(0, frames.length, ...saved)
    active.delete(fn.node)
    return result
  }

  function execBlock(block) {
    let result = UNKNOWN
    let returned = false
    hoist(block)
    for (const stmt of block.statements) {
      if (ts.isReturnStatement(stmt)) {
        const value = stmt.expression ? evalExpr(stmt.expression) : UNKNOWN
        result = returned ? mergeText([result, value]) : value
        returned = true
      } else visit(stmt)
    }
    return result
  }

  function evalCall(node) {
    const callee = node.expression
    if (ts.isIdentifier(callee)) {
      const bound = lookup(callee.text)
      if (bound?.kind === "fn") return callFn(bound, node.arguments)
      if (bound?.kind === "pathfn")
        return pathOps.doPath(bound.op, node.arguments)
      if (bound?.kind === "urlfn")
        return pathOps.doUrl(bound.op, node.arguments)
      if (!bound && callee.text === "readFileSync")
        return readCall(node.arguments)
      if (!bound && callee.text === "expect") return expectCall(node.arguments)
      evalList(node.arguments)
      return UNKNOWN
    }
    if (
      ts.isPropertyAccessExpression(callee) ||
      ts.isPropertyAccessChain(callee)
    ) {
      const name = callee.name.text
      if (
        name === "cwd" &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === "process"
      )
        return { kind: "cwd" }
      const recv = evalExpr(callee.expression)
      if (recv.kind === "pathmod" && name === "posix") return recv
      if (recv.kind === "pathmod" && PATH_OPS.has(name))
        return pathOps.doPath(name, node.arguments)
      if (SEARCH.has(name)) considerSearch(node, name, recv)
      evalList(node.arguments)
      if (recv.kind === "text" && KEEPS_TEXT.has(name)) return recv
      if (recv.kind === "expect" && name === "not")
        return { kind: "expect", inner: recv.inner, negated: true }
      if (
        recv.kind === "array" &&
        name === "join" &&
        recv.items.length > 0 &&
        recv.items.every((item) => item.kind === "text")
      )
        return mergeText(recv.items)
      return UNKNOWN
    }
    evalExpr(callee)
    evalList(node.arguments)
    return UNKNOWN
  }

  function readCall(argNodes) {
    const args = evalList(argNodes)
    if (!args || args[0]?.kind !== "path" || args[0].path === ".")
      return UNKNOWN
    return { kind: "text", files: [args[0].path] }
  }

  function expectCall(argNodes) {
    const args = evalList(argNodes)
    if (!args) return UNKNOWN
    return { kind: "expect", inner: args[0] ?? UNKNOWN, negated: false }
  }

  function evalExpr(node) {
    if (!node) return UNKNOWN
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      return { kind: "str", value: node.text }
    if (ts.isTemplateExpression(node)) {
      let value = node.head.text
      for (const span of node.templateSpans) {
        const part = evalExpr(span.expression)
        if (part.kind !== "str") return UNKNOWN
        value += part.value + span.literal.text
      }
      return { kind: "str", value }
    }
    if (ts.isNumericLiteral(node))
      return { kind: "num", value: Number(node.text) }
    if (ts.isIdentifier(node)) {
      const bound = lookup(node.text)
      if (bound) return bound
      if (node.text === "__dirname")
        return pathOps.pathValue(path.posix.dirname(file))
      if (node.text === "__filename") return pathOps.pathValue(file)
      return UNKNOWN
    }
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isExpressionWithTypeArguments(node)
    )
      return evalExpr(node.expression)
    if (
      ts.isAwaitExpression(node) ||
      ts.isVoidExpression(node) ||
      ts.isTypeOfExpression(node) ||
      ts.isDeleteExpression(node)
    )
      return evalExpr(node.expression)
    if (ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node)) {
      if (
        ts.isMetaProperty(node.expression) &&
        node.expression.keywordToken === ts.SyntaxKind.ImportKeyword
      ) {
        if (node.name.text === "url") return { kind: "url", href: testUrl }
        if (node.name.text === "dirname")
          return pathOps.pathValue(path.posix.dirname(file))
      }
      const recv = evalExpr(node.expression)
      if (recv.kind === "pathmod" && node.name.text === "posix") return recv
      if (recv.kind === "expect" && node.name.text === "not")
        return { kind: "expect", inner: recv.inner, negated: true }
      return UNKNOWN
    }
    if (ts.isMetaProperty(node)) return UNKNOWN
    if (ts.isCallExpression(node)) return evalCall(node)
    if (ts.isNewExpression(node)) return evalNew(node)
    if (ts.isArrayLiteralExpression(node)) {
      if (node.elements.some((el) => ts.isSpreadElement(el))) return UNKNOWN
      return { kind: "array", items: node.elements.map((el) => evalExpr(el)) }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      const left = evalExpr(node.left)
      const right = evalExpr(node.right)
      if (left.kind === "text" || right.kind === "text") return UNKNOWN
      if (left.kind === "str" && right.kind === "str")
        return { kind: "str", value: left.value + right.value }
      if (left.kind === "path" && right.kind === "str")
        return pathOps.pathValue(path.posix.join(left.path, right.value))
      return UNKNOWN
    }
    if (
      ts.isBinaryExpression(node) ||
      ts.isPrefixUnaryExpression(node) ||
      ts.isPostfixUnaryExpression(node)
    ) {
      if (ts.isBinaryExpression(node)) {
        evalExpr(node.left)
        evalExpr(node.right)
      } else evalExpr(node.operand)
      return UNKNOWN
    }
    if (ts.isConditionalExpression(node)) {
      evalExpr(node.condition)
      const yes = evalExpr(node.whenTrue)
      const no = evalExpr(node.whenFalse)
      if (yes.kind === "text" && no.kind === "text") return mergeText([yes, no])
      if (yes.kind === "path" && no.kind === "path" && yes.path === no.path)
        return yes
      return UNKNOWN
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
      return evalFunction(node)
    if (ts.isObjectLiteralExpression(node)) {
      for (const prop of node.properties) visit(prop)
      return UNKNOWN
    }
    return UNKNOWN
  }

  function bindDeclaration(decl) {
    if (!decl || !ts.isIdentifier(decl.name)) return
    const init = decl.initializer ? evalExpr(decl.initializer) : UNKNOWN
    bind(decl.name.text, init)
  }

  function visit(node) {
    if (!node) return
    if (ts.isBlock(node) || ts.isSourceFile(node) || ts.isModuleBlock(node)) {
      walkBlock(node)
      return
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations)
        bindDeclaration(decl)
      return
    }
    if (ts.isFunctionDeclaration(node)) {
      walkFunction(node)
      return
    }
    if (ts.isExpressionStatement(node)) {
      evalExpr(node.expression)
      return
    }
    if (ts.isIfStatement(node)) {
      evalExpr(node.expression)
      visit(node.thenStatement)
      visit(node.elseStatement)
      return
    }
    if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
      evalExpr(node.expression)
      frames.push(new Map())
      const init = node.initializer
      if (ts.isVariableDeclarationList(init)) {
        const decl = init.declarations[0]
        if (decl && ts.isIdentifier(decl.name)) bind(decl.name.text, UNKNOWN)
      } else if (ts.isIdentifier(init)) bind(init.text, UNKNOWN)
      visit(node.statement)
      frames.pop()
      return
    }
    if (
      ts.isForStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node)
    ) {
      if (ts.isForStatement(node)) {
        visit(node.initializer)
        if (node.condition) evalExpr(node.condition)
        if (node.incrementor) evalExpr(node.incrementor)
      } else evalExpr(node.expression)
      visit(node.statement)
      return
    }
    if (ts.isSwitchStatement(node)) {
      evalExpr(node.expression)
      for (const clause of node.caseBlock.clauses) {
        if (clause.expression) evalExpr(clause.expression)
        for (const stmt of clause.statements) visit(stmt)
      }
      return
    }
    if (ts.isTryStatement(node)) {
      visit(node.tryBlock)
      if (node.catchClause) visit(node.catchClause.block)
      visit(node.finallyBlock)
      return
    }
    if (ts.isReturnStatement(node) || ts.isThrowStatement(node)) {
      if (node.expression) evalExpr(node.expression)
      return
    }
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      for (const member of node.members) {
        if (
          member.body &&
          (ts.isConstructorDeclaration(member) ||
            ts.isMethodDeclaration(member) ||
            ts.isGetAccessor(member) ||
            ts.isSetAccessor(member))
        )
          walkFunction(member)
      }
      return
    }
    if (ts.isBlock(node)) walkBlock(node)
  }

  function hoist(block) {
    for (const stmt of block.statements) {
      if (ts.isFunctionDeclaration(stmt) && stmt.name) {
        bind(stmt.name.text, {
          kind: "fn",
          node: stmt,
          params: paramNames(stmt),
          body: stmt.body,
          frames: frames.slice(),
        })
      }
    }
  }

  function walkBlock(block) {
    frames.push(new Map())
    hoist(block)
    for (const stmt of block.statements) visit(stmt)
    frames.pop()
  }

  pathOps = createPathOps({ root, file, exists, evalList })
  walkBlock(sourceFile)
  return [...hits].sort()
}
