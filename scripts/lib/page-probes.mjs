import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..")
const fromWeb = createRequire(path.join(root, "apps/web/package.json"))
const { Linter } = fromWeb("eslint")
const fromEslint = createRequire(fromWeb.resolve("eslint"))
const espree = fromEslint("espree")
const eslintScope = fromEslint("eslint-scope")
const globals = fromWeb("globals")

export const PAGE_CALLS = new Set([
  "evaluate",
  "evaluateHandle",
  "evaluateOnNewDocument",
  "addInitScript",
  "waitForFunction",
  "$eval",
  "$$eval",
])

const PAGE_GLOBALS = Object.freeze({ ...globals.builtin, ...globals.browser })

const linter = new Linter()

const isFunction = (node) =>
  node?.type === "FunctionExpression" ||
  node?.type === "ArrowFunctionExpression" ||
  node?.type === "FunctionDeclaration"

function walk(node, visit) {
  if (!node || typeof node.type !== "string") return
  visit(node)
  for (const [key, value] of Object.entries(node)) {
    if (key === "loc" || key === "range" || key === "parent") continue
    if (Array.isArray(value)) for (const child of value) walk(child, visit)
    else if (value && typeof value === "object") walk(value, visit)
  }
}

function functionBindings(ast) {
  const byIdentifier = new Map()
  const scopes = eslintScope.analyze(ast, {
    ecmaVersion: 2022,
    sourceType: "module",
  }).scopes
  for (const scope of scopes)
    for (const reference of scope.references) {
      const definition = reference.resolved?.defs[0]
      const target =
        definition?.type === "FunctionName"
          ? definition.node
          : definition?.type === "Variable" && isFunction(definition.node.init)
            ? definition.node.init
            : null
      if (target) byIdentifier.set(reference.identifier, target)
    }
  return byIdentifier
}

const calleeName = (callee) =>
  callee.type === "MemberExpression" && !callee.computed
    ? callee.property.name
    : callee.type === "Identifier"
      ? callee.name
      : null

const isStringish = (node) =>
  node.type === "TemplateLiteral" ||
  (node.type === "Literal" && typeof node.value === "string")

function serializedNodes(ast, bindings) {
  const found = new Map()
  const take = (node, via) => {
    const target = node.type === "Identifier" ? bindings.get(node) : node
    if (isFunction(target) && !found.has(target)) found.set(target, via)
  }
  walk(ast, (node) => {
    if (node.type === "TemplateLiteral")
      for (const hole of node.expressions)
        if (hole.type === "Identifier") take(hole, "template")
    if (node.type === "CallExpression") {
      const name = calleeName(node.callee)
      if (
        name === "toString" &&
        node.callee.type === "MemberExpression" &&
        node.callee.object.type === "Identifier"
      )
        take(node.callee.object, "toString")
      if (name === "String" && node.arguments[0]?.type === "Identifier")
        take(node.arguments[0], "String")
      if (PAGE_CALLS.has(name))
        for (const argument of node.arguments)
          if (isFunction(argument) || argument.type === "Identifier")
            take(argument, name)
    }
    if (
      node.type === "BinaryExpression" &&
      node.operator === "+" &&
      (isStringish(node.left) || isStringish(node.right))
    )
      for (const side of [node.left, node.right])
        if (side.type === "Identifier") take(side, "concatenation")
  })
  return found
}

const probeName = (node) =>
  node.id?.name ?? node.parent?.id?.name ?? "anonymous function"

export function pageProbes(source) {
  const ast = espree.parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    loc: true,
    range: true,
  })
  walk(ast, (node) => {
    for (const value of Object.values(node))
      if (value && typeof value === "object" && typeof value.type === "string")
        value.parent ??= node
  })
  return [...serializedNodes(ast, functionBindings(ast))].map(
    ([node, via]) => ({
      name: probeName(node),
      via,
      line: node.loc.start.line,
      source: source.slice(...node.range),
    })
  )
}

export function undefinedNames(probeSource) {
  return linter.verify(`(${probeSource})`, {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: PAGE_GLOBALS,
    },
    rules: { "no-undef": "error" },
  })
}

export function detect(source, file = "<source>") {
  return pageProbes(source).flatMap((probe) =>
    undefinedNames(probe.source).map(
      (message) =>
        `${file}:${probe.line + message.line - 1} ${probe.name} (sent to the page by ${probe.via}): ${message.message.replace(/\.$/, "")}. A serialized probe sees only browser globals and its own parameters; pass the value in as an argument or declare it inside the probe.`
    )
  )
}
