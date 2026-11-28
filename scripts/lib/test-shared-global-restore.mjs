import ts from "typescript"

const ISOLATED_BY_NAME = /\.isolated\.test\.tsx?$/
const ATOM_ASSIGN = /\$store\.atoms\.([A-Za-z_$][\w$]*)\s*=(?!=)/g
const ATOM_DELETE = /delete\s+[\w$.]*\$store\.atoms\.([A-Za-z_$][\w$]*)/g

const SHARED_POOL =
  "the shared vitest pool keeps one module graph and one document between test files"

function escape(name) {
  return name.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")
}

function atomProblems(source, path) {
  const problems = []
  for (const [, name] of source.matchAll(ATOM_DELETE))
    problems.push(
      `${path}: deletes the auth store atom ${name}; save the live atom before replacing it and put it back after, ${SHARED_POOL}`
    )
  const replaced = new Set(
    [...source.matchAll(ATOM_ASSIGN)].map(([, name]) => name)
  )
  for (const name of replaced) {
    const atom = `\\$store\\.atoms\\.${escape(name)}`
    const saved = new RegExp(`=\\s*[\\w$.]*${atom}\\s*(?:;|\\n|$)`).test(source)
    const restored = new RegExp(
      `${atom}\\s*=\\s*[A-Za-z_$][\\w$]*\\s*(?:;|\\n|$)`
    ).test(source)
    if (!saved || !restored)
      problems.push(
        `${path}: replaces the auth store atom ${name} without saving the live atom and putting it back; ${SHARED_POOL}`
      )
  }
  return problems
}

function isPrototypeMember(node) {
  if (
    !ts.isPropertyAccessExpression(node) &&
    !ts.isElementAccessExpression(node)
  )
    return false
  const owner = node.expression
  return ts.isPropertyAccessExpression(owner) && owner.name.text === "prototype"
}

function moduleScopeProtoWrites(sourceFile) {
  const writes = []
  const visit = (node) => {
    if (ts.isFunctionLike(node) || ts.isClassLike(node)) return
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText()
      if (
        (callee === "Object.defineProperty" || callee === "Object.assign") &&
        node.arguments[0] &&
        ts.isPropertyAccessExpression(node.arguments[0]) &&
        node.arguments[0].name.text === "prototype"
      )
        writes.push(node.arguments[0].getText())
      return
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      if (isPrototypeMember(node.left)) writes.push(node.left.getText())
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(sourceFile, visit)
  return writes
}

export function detect(source, path) {
  if (ISOLATED_BY_NAME.test(path)) return []
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  return [
    ...atomProblems(source, path),
    ...moduleScopeProtoWrites(sourceFile).map(
      (write) =>
        `${path}: writes ${write} at module scope, so it stays for every later test file; install it in beforeAll and remove it in afterAll, ${SHARED_POOL}`
    ),
  ]
}
