import ts from "typescript"

function sourceOf(text) {
  return ts.createSourceFile(
    "paper-local.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
}

function isTimeoutCall(node) {
  if (!ts.isCallExpression(node)) return false
  if (ts.isIdentifier(node.expression))
    return node.expression.text === "setTimeout"
  return (
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "setTimeout"
  )
}

function callsNamed(node, name) {
  let found = false
  const walk = (child) => {
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      child.expression.text === name
    ) {
      found = true
    }
    ts.forEachChild(child, walk)
  }
  walk(node)
  return found
}

function functionBodies(source) {
  const bodies = new Map()
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body)
      bodies.set(node.name.text, node.body)
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isFunctionLike(node.initializer) &&
      node.initializer.body
    )
      bodies.set(node.name.text, node.initializer.body)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return bodies
}

function timeoutSaves(body) {
  let found = false
  const walk = (node) => {
    if (isTimeoutCall(node)) {
      const callback = node.arguments[0]
      if (
        callback &&
        ts.isFunctionLike(callback) &&
        callsNamed(callback, "save")
      )
        found = true
    }
    ts.forEachChild(node, walk)
  }
  walk(body)
  return found
}

function calledNames(body) {
  const names = new Set()
  const walk = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression))
      names.add(node.expression.text)
    ts.forEachChild(node, walk)
  }
  walk(body)
  return names
}

export function detectSynchronousJournal(text) {
  const source = sourceOf(text)
  const bodies = functionBodies(source)
  const hits = []
  let scoped = false
  const directJournal = (node) => {
    if (ts.isAwaitExpression(node) || ts.isFunctionLike(node)) return false
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "rememberLocal"
    )
      return true
    return ts.forEachChild(node, directJournal) ?? false
  }
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "appendJournal" &&
      node.arguments.length < 4
    )
      hits.push("a recovery journal must keep its document epoch and basis")
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "journalScope" &&
      node.arguments.some((arg) => ts.isIdentifier(arg) && arg.text === "tabId")
    )
      scoped = true
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "client" &&
      node.expression.name.text === "subscribe"
    ) {
      const callback = node.arguments[0]
      const remember = bodies.get("rememberLocal")
      if (
        !callback ||
        !ts.isFunctionLike(callback) ||
        !callback.body ||
        !directJournal(callback.body) ||
        !remember ||
        !callsNamed(remember, "appendJournal")
      )
        hits.push("local input must write its recovery journal synchronously")
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!scoped) hits.push("each tab must own its recovery journal")
  return hits
}

export function detectDelayedRecovery(text) {
  const source = sourceOf(text)
  const hits = []
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "PERSIST_MS" &&
      node.initializer &&
      ts.isNumericLiteral(node.initializer) &&
      Number(node.initializer.text) > 0
    )
      hits.push("a timer sits in front of the first recovery save")
    ts.forEachChild(node, visit)
  }
  visit(source)
  const bodies = functionBodies(source)
  const walkSubscribe = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "subscribe" &&
      node.arguments[0] &&
      ts.isFunctionLike(node.arguments[0]) &&
      node.arguments[0].body
    ) {
      const body = node.arguments[0].body
      if (timeoutSaves(body))
        hits.push("a timer sits in front of the first recovery save")
      for (const name of calledNames(body)) {
        const helper = bodies.get(name)
        if (helper && timeoutSaves(helper))
          hits.push("a timer sits in front of the first recovery save")
      }
    }
    ts.forEachChild(node, walkSubscribe)
  }
  walkSubscribe(source)
  return hits
}

function resolvesOnRequestSuccess(node) {
  let found = false
  const walk = (child) => {
    if (
      ts.isBinaryExpression(child) &&
      child.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(child.left) &&
      child.left.name.text === "onsuccess" &&
      ts.isFunctionLike(child.right) &&
      callsNamed(child.right, "resolve")
    )
      found = true
    ts.forEachChild(child, walk)
  }
  walk(node)
  return found
}

function successHelpers(source) {
  const names = new Set()
  const visit = (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      node.body &&
      resolvesOnRequestSuccess(node.body)
    )
      names.add(node.name.text)
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isFunctionLike(node.initializer) &&
      node.initializer.body &&
      resolvesOnRequestSuccess(node.initializer.body)
    )
      names.add(node.name.text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return names
}

function saveMethods(source) {
  const methods = []
  const visit = (node) => {
    if (
      ts.isMethodDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "save" &&
      node.body
    )
      methods.push(node.body)
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "save" &&
      node.initializer &&
      ts.isFunctionLike(node.initializer) &&
      node.initializer.body
    )
      methods.push(node.initializer.body)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return methods
}

export function detectRequestDurability(text) {
  const source = sourceOf(text)
  const helpers = successHelpers(source)
  const hits = []
  for (const body of saveMethods(source)) {
    if (resolvesOnRequestSuccess(body))
      hits.push("durability is taken from IDBRequest success")
    for (const name of calledNames(body)) {
      if (helpers.has(name))
        hits.push("durability is taken from IDBRequest success")
    }
  }
  return hits
}

export function detectSavedBeforeDurability(text) {
  const source = sourceOf(text)
  const conjuncts = (node) =>
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      ? [...conjuncts(node.left), ...conjuncts(node.right)]
      : [node]
  const gate = functionBodies(source).get("canShowSaved")
  const terms = gate ? conjuncts(gate) : []
  const equalVersion = (name) =>
    terms.some(
      (node) =>
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
        ts.isIdentifier(node.left) &&
        node.left.text === name &&
        ts.isIdentifier(node.right) &&
        node.right.text === "version"
    )
  const pending = terms.some(
    (node) =>
      ts.isPrefixUnaryExpression(node) &&
      node.operator === ts.SyntaxKind.ExclamationToken &&
      ts.isCallExpression(node.operand) &&
      ts.isPropertyAccessExpression(node.operand.expression) &&
      node.operand.expression.name.text === "hasPending"
  )
  const hits = []
  if (
    !equalVersion("durableVersion") ||
    !equalVersion("acceptedVersion") ||
    !pending
  )
    hits.push(
      "Saved needs the exact current local completion and server receipt"
    )
  const gated = (node) =>
    conjuncts(node).some(
      (part) =>
        ts.isCallExpression(part) &&
        ts.isIdentifier(part.expression) &&
        part.expression.text === "canShowSaved"
    )
  const saved = (node) => ts.isStringLiteral(node) && node.text === "saved"
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "setStatus" &&
      node.arguments[0]
    ) {
      const value = node.arguments[0]
      if (
        ts.isConditionalExpression(value) &&
        saved(value.whenTrue) &&
        !gated(value.condition)
      )
        hits.push("Saved must use the current snapshot gate")
      if (saved(value)) {
        let child = node
        let parent = child.parent
        let guarded = false
        while (parent && !ts.isFunctionLike(parent)) {
          if (
            ts.isIfStatement(parent) &&
            parent.thenStatement === child &&
            gated(parent.expression)
          )
            guarded = true
          child = parent
          parent = child.parent
        }
        if (!guarded) hits.push("Saved must use the current snapshot gate")
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}

export function detectLocalDurability(text) {
  return [...detectDelayedRecovery(text), ...detectSavedBeforeDurability(text)]
}
