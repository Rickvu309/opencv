import ts from "typescript"

export function detectNativeDurability(text) {
  const source = ts.createSourceFile(
    "native.ts",
    text,
    ts.ScriptTarget.Latest,
    true
  )
  const hits = []
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "indexedDbStore" &&
      node.arguments[0]?.kind !== ts.SyntaxKind.TrueKeyword
    )
      hits.push("native recovery must use an isolated database")
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "seedYDoc"
    )
      hits.push(
        "native bootstrap must preserve authoritative server CRDT bytes"
      )
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "releaseLock"
    ) {
      let parent = node.parent
      while (
        parent &&
        !(
          ts.isCallExpression(parent) &&
          parent.expression.getText(source) === "persistence.then"
        )
      )
        parent = parent.parent
      const inDestroy = (() => {
        let ancestor = node.parent
        while (ancestor) {
          if (
            ts.isVariableDeclaration(ancestor) &&
            ancestor.name.getText(source) === "destroy"
          )
            return true
          ancestor = ancestor.parent
        }
        return false
      })()
      if (inDestroy && !parent)
        hits.push(
          "shutdown must retain the tab lock until local persistence settles"
        )
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === "initialized" &&
      node.initializer
    ) {
      let lockedAt = -1
      let rereadAt = -1
      const inspect = (child) => {
        if (ts.isCallExpression(child)) {
          const call = child.expression.getText(source)
          if (
            call === "holdNativeTabLock" &&
            child.arguments[1]?.getText(source) === "orphanTab"
          )
            lockedAt = child.pos
          if (
            call === "store.load" &&
            child.arguments[1]?.getText(source) === "orphanTab"
          )
            rereadAt = child.pos
          if (call === "recoveryLocks.splice")
            hits.push(
              "recovery locks must survive initialization until shutdown"
            )
        }
        ts.forEachChild(child, inspect)
      }
      inspect(node.initializer)
      if (lockedAt >= 0 && rereadAt <= lockedAt)
        hits.push("orphan snapshots must be reread after taking their locks")
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "scope" &&
      node.initializer &&
      !node.initializer.getText(source).startsWith("nativeRecoveryScope(")
    )
      hits.push("persistent native scope must exclude the ephemeral session")
    if (
      ts.isCatchClause(node) &&
      /return\s*\[\]/.test(node.block.getText(source))
    )
      hits.push(
        "an unreadable native scan must refuse instead of appearing empty"
      )
    if (
      ts.isReturnStatement(node) &&
      node.expression &&
      ts.isStringLiteral(node.expression) &&
      node.expression.text === "saved"
    ) {
      const condition = ts.isIfStatement(node.parent)
        ? node.parent.expression.getText(source).replace(/\s/g, "")
        : ""
      if (
        ![
          "durableVersion===version",
          "acceptedVersion===version",
          "!client.hasPending()",
        ].every((term) => condition.includes(term))
      )
        hits.push(
          "Saved needs exact local and server generations without pending input"
        )
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}

export function detectNativeStoreAdmission(text) {
  const source = ts.createSourceFile(
    "store.ts",
    text,
    ts.ScriptTarget.Latest,
    true
  )
  const hits = []
  for (const node of source.statements) {
    if (
      !ts.isFunctionDeclaration(node) ||
      node.name?.text !== "indexedDbStore" ||
      !node.body
    )
      continue
    const visit = (child) => {
      if (
        ts.isMethodDeclaration(child) &&
        child.name.getText(source) === "load" &&
        child.body &&
        !/if\s*\(native\s*&&\s*!held\)\s*throw\b/.test(
          child.body.getText(source)
        )
      )
        hits.push(
          "native loading must refuse an unavailable lock scan before using the legacy age fallback"
        )
      ts.forEachChild(child, visit)
    }
    visit(node.body)
  }
  return hits
}
