import ts from "typescript"
import { toRepoPath } from "./source-imports.mjs"

const parse = (file, text) =>
  ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
const snapshotOf = (value) =>
  typeof value === "string" ? JSON.parse(value) : value
const literal = (node) => (ts.isStringLiteralLike(node) ? node.text : null)
const testFile = (file) => /(?:\.test\.|\.type-test\.|\/test\/)/.test(file)
const generated = (file) => file.includes("/generated/")
const spelling = (node, source) => node?.getText(source).replace(/\s+/g, "")

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

function catalogConsumer(file, source) {
  const program = ts.createProgram(
    [file],
    { noLib: true, noResolve: true },
    {
      getSourceFile: (name) => (name === file ? source : undefined),
      getDefaultLibFileName: () => "",
      writeFile: () => {},
      getCurrentDirectory: () => "",
      getDirectories: () => [],
      fileExists: (name) => name === file,
      readFile: (name) => (name === file ? source.text : undefined),
      getCanonicalFileName: (name) => name,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => "\n",
    }
  )
  const checker = program.getTypeChecker()
  return (call) => {
    if (
      !ts.isPropertyAccessExpression(call.expression) ||
      !["run", "options", "useRead", "key"].includes(call.expression.name.text)
    )
      return false
    const receiver = call.expression.expression
    const binding = ts.isIdentifier(receiver)
      ? receiver
      : ts.isPropertyAccessExpression(receiver) &&
          receiver.name.text === "catalogClient" &&
          ts.isIdentifier(receiver.expression)
        ? receiver.expression
        : null
    if (!binding) return false
    const declarations =
      checker.getSymbolAtLocation(binding)?.declarations ?? []
    return declarations.some((declaration) => {
      let imported
      if (
        ts.isImportSpecifier(declaration) &&
        receiver === binding &&
        (declaration.propertyName ?? declaration.name).text ===
          "catalogClient" &&
        !declaration.isTypeOnly &&
        !declaration.parent.parent.isTypeOnly
      )
        imported = declaration.parent.parent.parent
      if (
        ts.isNamespaceImport(declaration) &&
        receiver !== binding &&
        !declaration.parent.isTypeOnly
      )
        imported = declaration.parent.parent
      return (
        imported &&
        ts.isImportDeclaration(imported) &&
        ts.isStringLiteral(imported.moduleSpecifier) &&
        [
          "apps/web/src/lib/contract-client",
          "apps/web/src/lib/contract-client.ts",
          "apps/web/src/lib/contract-client.js",
        ].includes(toRepoPath(imported.moduleSpecifier.text, file))
      )
    })
  }
}

export function detectDefinitions(value) {
  const snapshot = snapshotOf(value)
  const operations = new Map(
    snapshot.operations.map((operation) => [operation.name, operation])
  )
  const problems = []
  for (const [file, text] of snapshot.sources) {
    if (testFile(file) || generated(file)) continue
    const source = parse(file, text)
    let sanctioned
    walk(source, (node) => {
      const text = ts.isStringLiteralLike(node)
        ? node.text
        : ts.isTemplateExpression(node)
          ? node.templateSpans.at(-1).literal.text
          : null
      if (text === null) return
      const name = [...operations.keys()].find(
        (name) =>
          text === name ||
          ["commands", "reads"].some((kind) =>
            text.endsWith(`/${kind}/${name}`)
          )
      )
      const operation = operations.get(name)
      if (!operation || file === operation.file || file === operation.server)
        return
      const parent = node.parent
      const property =
        ts.isPropertyAssignment(parent) &&
        (parent.name === node || spelling(parent.name, source) === "name")
      const adapter =
        ts.isCallExpression(parent) &&
        (text !== name ||
          !(sanctioned ??= catalogConsumer(file, source))(parent)) &&
        (/\/(?:http|commands|queries)\.ts$/.test(file) ||
          file.startsWith("apps/web/src/"))
      const key =
        ts.isArrayLiteralExpression(parent) && file.startsWith("apps/web/src/")
      if (property || adapter || key)
        problems.push({
          kind: "duplicate-adapter",
          file,
          name,
          line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        })
    })
  }
  return problems
}

function importTargets(file, source) {
  const targets = []
  walk(source, (node) => {
    let specifier
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    )
      specifier = literal(node.moduleSpecifier)
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0]
    )
      specifier = literal(node.arguments[0])
    if (!specifier) return
    const context = /^@workspace\/domain\/([a-z-]+)$/.exec(specifier)?.[1]
    const target = context
      ? `packages/domain/src/${context}/public.ts`
      : toRepoPath(specifier, file)
    if (target) targets.push(target.replace(/\.js$/, ".ts"))
  })
  return targets
}

function method(source, name) {
  let found
  walk(source, (node) => {
    if (
      (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) &&
      node.name?.getText(source) === name
    )
      found = node
  })
  return found
}

function returned(node) {
  const values = []
  if (node)
    walk(node, (child) => {
      if (ts.isReturnStatement(child) && child.expression)
        values.push(child.expression)
    })
  return values
}

function fields(node) {
  return node && ts.isObjectLiteralExpression(node)
    ? new Map(
        node.properties
          .filter(ts.isPropertyAssignment)
          .map((field) => [field.name.getText(), field.initializer])
      )
    : new Map()
}

function projectedReceipts(source) {
  const problems = []
  const activity = returned(method(source, "publicActivity"))[0]
  const safeActivity =
    activity &&
    ts.isConditionalExpression(activity) &&
    spelling(activity.condition, source) ===
      "this.operations.has(row.command)" &&
    spelling(activity.whenFalse, source) === "row" &&
    ts.isObjectLiteralExpression(activity.whenTrue) &&
    activity.whenTrue.properties.length === 5 &&
    spelling(activity.whenTrue.properties[0], source) === "...row" &&
    [...fields(activity.whenTrue)]
      .map(([name, value]) => `${name}:${spelling(value, source)}`)
      .sort()
      .join(";") ===
      "detail:null;result:this.publicOutput(row.command,row.result);reversalExpect:null;reversalInput:{}"
  if (!safeActivity) problems.push("raw-public-activity")
  const confirmation = returned(method(source, "confirmationReceipt"))[0]
  const safeConfirmation =
    confirmation &&
    ts.isConditionalExpression(confirmation) &&
    spelling(confirmation.condition, source) === "completed" &&
    spelling(confirmation.whenFalse, source) === "undefined" &&
    ts.isObjectLiteralExpression(confirmation.whenTrue) &&
    confirmation.whenTrue.properties.length === 5 &&
    spelling(fields(confirmation.whenTrue).get("summary"), source) ===
      "completed.summary" &&
    spelling(fields(confirmation.whenTrue).get("activityId"), source) ===
      "completed.id" &&
    spelling(fields(confirmation.whenTrue).get("undone"), source) ===
      "completed.undoneAt!==null" &&
    spelling(fields(confirmation.whenTrue).get("reversal"), source) ===
      "reversalOf(completed.reversalCommand?{command:completed.reversalCommand,input:this.operations.has(completed.command)?{}:completed.reversalInput,}:null,completed.summary)" &&
    spelling(fields(confirmation.whenTrue).get("detail"), source) ===
      "this.operations.has(completed.command)?receiptDetail(completed.command,this.publicOutput(completed.command,completed.result)):receiptDetail(completed.command,completed.result)"
  if (!safeConfirmation) problems.push("raw-confirmation-receipt")
  const turn = returned(method(source, "turnReceipts"))[0]
  if (
    !turn ||
    spelling(turn, source) !==
      "receipts.map((receipt)=>({...receipt,result:this.publishResult(receipt.name,receipt.result),}))"
  )
    problems.push("raw-turn-receipt")
  return problems
}

export function detectReplayIdentity(text) {
  const source = parse("registry.ts", text)
  const problems = []
  const replay = method(source, "replayByKey")
  const body = replay?.body
  const mismatch =
    body?.statements.findIndex(
      (node) =>
        ts.isIfStatement(node) &&
        spelling(node.expression, source) ===
          "stored.command!==command||(stored.inputHash!==null&&stored.inputHash!==hash)" &&
        ts.isThrowStatement(node.thenStatement)
    ) ?? -1
  if (
    mismatch < 0 ||
    !body.statements.slice(mismatch + 1).some(ts.isReturnStatement)
  )
    problems.push("unbound-keyed-replay")
  let hashes = 0
  let lookups = 0
  walk(source, (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      spelling(node.name, source) === "inputHash" &&
      spelling(node.initializer, source) === "hash"
    )
      hashes++
    if (
      ts.isCallExpression(node) &&
      spelling(node.expression, source) === "this.replayByKey" &&
      node.arguments.length === 4 &&
      spelling(node.arguments[2], source) === "command.name" &&
      spelling(node.arguments[3], source) === "hash!"
    )
      lookups++
  })
  if (hashes !== 2 || lookups !== 2) problems.push("unbound-keyed-storage")
  let boundHash = false
  let provenance = false
  walk(source, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      spelling(node.name, source) === "hash" &&
      spelling(node.initializer, source) ===
        "idempotencyKey?inputHash(jsonInput(parsed)):null"
    )
      boundHash = true
    if (
      ts.isCallExpression(node) &&
      spelling(node.expression, source) === "this.committedResult" &&
      spelling(node.arguments[0], source) === "result.command??command.name"
    )
      provenance = true
  })
  const normalized = returned(method(source, "jsonInput"))
  const canonical =
    normalized.length === 1 &&
    spelling(normalized[0], source) === "JSON.parse(JSON.stringify(input))"
  let admission = false
  const execute = method(source, "#execute") ?? method(source, "execute")
  if (execute)
    walk(execute, (node) => {
      if (
        ts.isCallExpression(node) &&
        spelling(node.expression, source) === "this.admitCommand" &&
        spelling(node.arguments[0], source) === "options"
      )
        admission = true
    })
  let validated = false
  const parsing = admission ? method(source, "admitCommand") : execute
  if (parsing)
    walk(parsing, (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        spelling(node.name, source) === "parsed" &&
        spelling(node.initializer, source) ===
          "parseInput(command.input,options.input)"
      )
        validated = true
    })
  if (!canonical || !validated) problems.push("uncanonical-keyed-input")
  let taskInput = false
  const taskCall = returned(method(source, "executeTask")).find(
    (node) =>
      ts.isCallExpression(node) &&
      spelling(node.expression, source) === "executeTaskCommand"
  )
  const taskCallback = taskCall?.arguments[3]
  if (
    taskCallback &&
    ts.isArrowFunction(taskCallback) &&
    spelling(taskCall.arguments[1], source) === "{...options}"
  )
    walk(taskCallback.body, (node) => {
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        spelling(node.left, source) === "input.input" &&
        spelling(node.right, source) ===
          "jsonInput(parseInput(command.input,input.input))"
      )
        taskInput = true
    })
  if (!taskInput) problems.push("uncanonical-task-input")
  if (
    !boundHash ||
    !provenance ||
    !replay ||
    !returned(replay).some(
      (value) =>
        fields(value).has("command") &&
        spelling(fields(value).get("command"), source) === "stored.command"
    )
  )
    problems.push("unbound-replay-provenance")
  return problems
}

export function detectPublication(value) {
  const snapshot = snapshotOf(value)
  const sources = new Map(snapshot.sources)
  const problems = []
  const foundation = "packages/domain/src/operation.ts"
  if (sources.has(foundation)) {
    for (const target of importTargets(
      foundation,
      parse(foundation, sources.get(foundation))
    )) {
      if (
        target === "packages/domain/src/contract.ts" ||
        target === "packages/domain/src/registry.ts" ||
        target === "packages/domain/src/catalog.ts" ||
        target.startsWith("packages/domain/src/generated/")
      )
        problems.push({
          kind: "descriptor-foundation",
          file: foundation,
          target,
        })
    }
  }
  const visited = new Set()
  const visit = (file) => {
    if (visited.has(file) || !sources.has(file)) return
    visited.add(file)
    if (
      file.startsWith("apps/api/") ||
      file.split("/").includes("server-only") ||
      file.endsWith("/server.ts")
    ) {
      problems.push({ kind: "private-import", file })
      return
    }
    const source = parse(file, sources.get(file))
    for (const target of importTargets(file, source)) {
      const resolved = [
        target,
        `${target}.ts`,
        `${target}.tsx`,
        `${target}/index.ts`,
        target.replace(/\.ts$/, ".tsx"),
      ].find((candidate) => sources.has(candidate))
      if (resolved) visit(resolved)
    }
    walk(source, (node) => {
      if (
        (file.startsWith("apps/web/src/") ||
          snapshot.operations.some((operation) => operation.file === file)) &&
        ts.isIdentifier(node) &&
        ["privateResult", "privateReceipt", "previousPriority"].includes(
          node.text
        )
      )
        problems.push({ kind: "private-symbol", file, symbol: node.text })
    })
  }
  for (const file of sources.keys())
    if (file.startsWith("apps/web/src/") && !testFile(file)) visit(file)
  for (const [file, text] of sources) {
    if (file.endsWith("/registry/registry.ts")) {
      const source = parse(file, text)
      let guarded = false
      walk(source, (node) => {
        if (
          ts.isCallExpression(node) &&
          spelling(node, source) === "assertReversal(ran)"
        )
          guarded = true
      })
      if (!guarded) problems.push({ kind: "unguarded-reversal", file })
    }
    if (file.endsWith("/registry/catalog-publication.ts")) {
      const source = parse(file, text)
      problems.push(
        ...projectedReceipts(source).map((kind) => ({ kind, file }))
      )
      const projection = returned(method(source, "publicOutput"))
      const valid =
        projection.length === 1 &&
        ts.isConditionalExpression(projection[0]) &&
        spelling(projection[0], source) ===
          "operation?operation.publicResult.parse(output):output"
      if (!valid) problems.push({ kind: "raw-public-output", file })
      const publisher = returned(method(source, "publishResult")).filter(
        ts.isObjectLiteralExpression
      )
      for (const result of publisher) {
        const properties = result.properties
        const outputAt = properties.findIndex(
          (property) =>
            ts.isPropertyAssignment(property) &&
            spelling(property.name, source) === "output" &&
            spelling(property.initializer, source) ===
              "this.publicOutput(name,result.output)"
        )
        if (
          outputAt < 0 ||
          properties.slice(outputAt + 1).some(ts.isSpreadAssignment)
        )
          problems.push({ kind: "raw-public-output", file })
        const reversal = properties.find(
          (property) =>
            ts.isPropertyAssignment(property) &&
            spelling(property.name, source) === "reversal"
        )
        const value = reversal?.initializer
        const fields =
          value &&
          ts.isConditionalExpression(value) &&
          ts.isObjectLiteralExpression(value.whenTrue)
            ? value.whenTrue.properties
            : []
        const safeReversal =
          value &&
          ts.isConditionalExpression(value) &&
          spelling(value.condition, source) === "result.reversal" &&
          value.whenFalse.kind === ts.SyntaxKind.NullKeyword &&
          fields.length === 2 &&
          fields.some(
            (field) =>
              ts.isPropertyAssignment(field) &&
              spelling(field.name, source) === "command" &&
              spelling(field.initializer, source) === "result.reversal.command"
          ) &&
          fields.some(
            (field) =>
              ts.isPropertyAssignment(field) &&
              spelling(field.name, source) === "input" &&
              ts.isObjectLiteralExpression(field.initializer) &&
              field.initializer.properties.length === 0
          )
        if (!safeReversal) problems.push({ kind: "private-reversal", file })
      }
      if (publisher.length !== 1)
        problems.push({ kind: "raw-public-output", file })
    }
    if (file.endsWith("/registry/bind.ts")) {
      const source = parse(file, text)
      let guarded = false
      const guard = method(source, "assertReversal")
      if (guard)
        walk(guard, (node) => {
          if (
            ts.isIfStatement(node) &&
            spelling(node.expression, source) ===
              "result.reversal&&(!result.reversal.expect||!Object.keys(result.reversal.expect.matches).length)" &&
            ts.isThrowStatement(node.thenStatement)
          )
            guarded = true
        })
      if (!guarded) problems.push({ kind: "unguarded-reversal", file })
      let projectedRead = false
      walk(source, (node) => {
        if (
          ts.isPropertyAssignment(node) &&
          spelling(node.name, source) === "read" &&
          ts.isArrowFunction(node.initializer)
        )
          projectedRead ||=
            spelling(node.initializer.body, source) ===
            "operation.publicResult.parse(awaitbinding.execute(input,actor))"
      })
      if (!projectedRead) problems.push({ kind: "raw-public-read", file })
    }
  }
  return problems
}
