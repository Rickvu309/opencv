import { readFileSync } from "node:fs"
import ts from "typescript"
import { describe, expect, it } from "vitest"

function source(file: string) {
  return ts.createSourceFile(
    file,
    readFileSync(new URL(file, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true
  )
}

const registry = [source("./registry.ts"), source("./registry-entries.ts")]

function nodes(root: ts.Node): ts.Node[] {
  const found = [root]
  ts.forEachChild(root, (child) => {
    found.push(...nodes(child))
  })
  return found
}

function calls(root: ts.Node) {
  return nodes(root)
    .filter(ts.isCallExpression)
    .map((call) => call.expression.getText())
}

function method(name: string) {
  const found = registry
    .flatMap(nodes)
    .filter(ts.isMethodDeclaration)
    .filter((node) => node.name.getText() === name)
  expect(found).toHaveLength(1)
  return calls(found[0]!)
}

describe("coachRefusal is the one decision on whether a Coach actor may use an entry", () => {
  it("tools, execute and read ask it, and approve reaches it through execute", () => {
    expect(method("tools")).toContain("coachRefusal")
    expect(method("execute")).toContain("this.#execute")
    expect(method("#execute")).toContain("this.admitCommand")
    expect(method("admitCommand")).toContain("coachRefusal")
    expect(method("read")).toContain("coachRefusal")
    expect(method("approve")).toContain("this.execute")
    expect(method("approve")).not.toContain("coachRefusal")
    for (const file of registry) {
      expect(
        file.statements
          .filter(ts.isImportDeclaration)
          .filter(
            (node) =>
              ts.isStringLiteral(node.moduleSpecifier) &&
              node.moduleSpecifier.text === "./coach-policy.js"
          )
      ).toHaveLength(1)
    }
    const policy = source("./coach-policy.ts")
    expect(
      policy.statements
        .filter(ts.isFunctionDeclaration)
        .filter((node) => node.name?.text === "coachRefusal")
    ).toHaveLength(1)
    expect(
      [...registry.flatMap(calls), ...calls(policy)].filter(
        (name) => name === "coachRefusal"
      )
    ).toHaveLength(4)
  })
})
