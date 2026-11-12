import ts from "typescript"

export const CONFIGURATION = new Set([
  "NODE_ENV",
  "VITEST",
  "MODE",
  "DEV",
  "PROD",
  "PORT",
  "VITE_API_URL",
  "VITE_PUBLIC_ORIGIN",
  "VITE_APP_ORIGIN",
  "PAPER_SYNC_RUNS",
  "PAPER_SYNC_STEPS",
  "PAPER_SYNC_TIMEOUT",
  "PAPER_SYNC_SEED",
  "PAPER_SYNC_PATH",
  "PAPER_SYNC_TRACE",
  "PAPER_SYNC_REBUILDS",
  "PHOTO_MODEL_RUNS",
])

export const SWITCHES_BEING_DELETED = new Set([
  "PAPER_AGENT_TOOLS",
  "COACH_DURABLE",
])

const CONFIGURATION_SUFFIX =
  /_(URL|URLS|ORIGIN|ORIGINS|HOST|PORT|SECRET|KEY|TOKEN|PASSWORD|LIMIT|MAX|TIMEOUT|DIR|PATH|MODEL|PROVIDER|DRIVER|REGION|BUCKET)$/

const PRODUCT_FILE = /^apps\/(api|web)\/src\//

const TEST_FILE = /(\.test\.|\.spec\.|\/test\/|\/__tests__\/)/

export function isConfiguration(name) {
  return (
    CONFIGURATION.has(name) ||
    SWITCHES_BEING_DELETED.has(name) ||
    CONFIGURATION_SUFFIX.test(name)
  )
}

export function isProductFile(file) {
  return PRODUCT_FILE.test(file) && !TEST_FILE.test(file)
}

function isEnv(node, source) {
  const text = node.getText(source)
  return text === "process.env" || text === "import.meta.env"
}

function readName(node, source) {
  if (ts.isPropertyAccessExpression(node) && isEnv(node.expression, source))
    return node.name.text
  if (
    ts.isElementAccessExpression(node) &&
    isEnv(node.expression, source) &&
    ts.isStringLiteralLike(node.argumentExpression)
  )
    return node.argumentExpression.text
  return null
}

function destructuredNames(node, source) {
  if (
    !ts.isVariableDeclaration(node) ||
    !node.initializer ||
    !isEnv(node.initializer, source) ||
    !ts.isObjectBindingPattern(node.name)
  )
    return []
  return node.name.elements.map((element) => ({
    node: element,
    name: (element.propertyName ?? element.name).getText(source),
  }))
}

export function detect(text, file = "apps/api/src/index.ts") {
  if (!isProductFile(file)) return []
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    kind
  )
  const problems = []
  const report = (node, name) => {
    if (isConfiguration(name)) return
    problems.push({
      kind: "unlisted-env-switch",
      name,
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    })
  }
  const visit = (node) => {
    const name = readName(node, source)
    if (name !== null) report(node, name)
    for (const found of destructuredNames(node, source))
      report(found.node, found.name)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return problems
}
