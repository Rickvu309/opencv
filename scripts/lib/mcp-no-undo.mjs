import ts from "typescript"

const NEVER_REACHABLE = [
  "activity.undo",
  "inbox.send",
  "account.delete",
  "actions.approve",
  "actions.deny",
  "paper.undoWord",
  "paper.restoreWord",
  "paper.sync",
  "paper.canvas",
  "job.undo",
  "chat.delete",
  "settings.update",
  "connections.revoke",
]
const FORBIDDEN_VERB = /approve|deny|undo|restore|sync|canvas/i
const FORBIDDEN_OWNER =
  /^(account|actions|activity|chat|coach|connections|inbox|settings|notify)\./
const DELEGATE_OWNER = /^(job|paper)\./

function markersFor(name) {
  const owner = name.split(".")[0]
  const markers = [undefined, "jobRead", "reversibleJob"]
  for (const resource of new Set([owner, "job", "paper"]))
    for (const access of ["read", "proposal"])
      markers.push({ resource, access })
  return markers
}

function reachableNames(statement) {
  if (!statement) return []
  let pairs
  const visit = (node) => {
    if (pairs) return
    if (
      ts.isNewExpression(node) &&
      node.expression.getText() === "Map" &&
      node.arguments?.[0] &&
      ts.isArrayLiteralExpression(node.arguments[0])
    )
      pairs = node.arguments[0]
    else ts.forEachChild(node, visit)
  }
  visit(statement)
  if (!pairs) return [null]
  return pairs.elements.map((pair) =>
    ts.isArrayLiteralExpression(pair) &&
    pair.elements.length === 2 &&
    ts.isStringLiteral(pair.elements[0])
      ? pair.elements[0].text
      : null
  )
}

export function detect(text, file = "delegate-policy.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const policy = source.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) && node.name?.text === "delegateAllowed"
  )
  if (!policy) return [{ line: 1, kind: "missing-delegate-filter" }]
  const reachable = source.statements.find(
    (node) =>
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "DELEGATE_REACHABLE"
      )
  )
  const hits = []
  if (!reachable) hits.push({ line: 1, kind: "missing-delegate-reachable-set" })
  for (const name of reachableNames(reachable)) {
    if (name === null) {
      hits.push({ line: 1, kind: "delegate-reachable-not-literal" })
      continue
    }
    if (
      !DELEGATE_OWNER.test(name) ||
      FORBIDDEN_OWNER.test(name) ||
      FORBIDDEN_VERB.test(name.slice(name.indexOf(".") + 1))
    )
      hits.push({ line: 1, kind: `delegate-reachable-lists-${name}` })
  }
  try {
    const javascript = ts.transpileModule(
      [reachable, policy]
        .filter(Boolean)
        .map((node) => node.getText(source).replace(/^export /, ""))
        .join("\n"),
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      }
    ).outputText
    const allowed = new Function(`${javascript}; return delegateAllowed`)()
    const scopes = ["connection.status"]
    for (const name of NEVER_REACHABLE) {
      const owner = name.split(".")[0]
      scopes.push(`${owner}.read`, `${owner}.write`)
    }
    for (const kind of ["jobs", "paper", "jobs-and-paper"]) {
      const actor = {
        type: "delegate",
        userId: "person",
        connectionId: "connection",
        resources: kind,
        reads: "allow",
        writes: "approval",
        scopes: [
          ...scopes,
          "job.read",
          "job.write",
          "paper.read",
          "paper.write",
        ],
      }
      for (const name of NEVER_REACHABLE)
        for (const coach of [true, "auto", "confirm", "never"])
          for (const delegate of markersFor(name))
            if (allowed({ name, coach, delegate }, actor))
              hits.push({ line: 1, kind: `delegate-can-use-${name}` })
    }
    if (
      !allowed(
        { name: "activity.undo", coach: "never" },
        { type: "person", userId: "person" }
      )
    ) {
      hits.push({ line: 1, kind: "person-undo-removed" })
    }
  } catch {
    hits.push({ line: 1, kind: "delegate-filter-not-verifiable" })
  }
  return [...new Map(hits.map((hit) => [hit.kind, hit])).values()]
}
