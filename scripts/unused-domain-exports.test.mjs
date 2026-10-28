import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import ts from "typescript"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const domainSrc = path.join(root, "packages/domain/src")
const PACKAGE = "@workspace/domain"
const SKIPPED_DIRS = new Set(["node_modules", "dist", ".turbo", ".git"])
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED_DIRS.has(entry.name)) return []
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return SOURCE_FILE.test(entry.name) && !entry.name.endsWith(".d.ts")
      ? [full]
      : []
  })
}

function parse(file) {
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true
  )
}

function exportedNames(sf) {
  const names = []
  for (const stmt of sf.statements) {
    if (ts.isExportDeclaration(stmt)) {
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) names.push(el.name.text)
      }
      continue
    }
    if (ts.isExportAssignment(stmt)) continue
    const exported = ts
      .getModifiers(stmt)
      ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (!exported) continue
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) names.push(decl.name.text)
      }
    } else if (stmt.name && ts.isIdentifier(stmt.name)) {
      names.push(stmt.name.text)
    }
  }
  return names
}

function reachesDomain(fromFile, specifier) {
  if (specifier === PACKAGE || specifier.startsWith(`${PACKAGE}/`)) return true
  if (!specifier.startsWith(".")) return false
  const target = path.resolve(path.dirname(fromFile), specifier)
  return target === domainSrc || target.startsWith(domainSrc + path.sep)
}

function importedNames(file, sf) {
  const used = new Set()
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      reachesDomain(file, node.moduleSpecifier.text)
    ) {
      const bindings = ts.isImportDeclaration(node)
        ? node.importClause?.namedBindings
        : node.exportClause
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          used.add((el.propertyName ?? el.name).text)
        }
      } else if (bindings && ts.isNamedExports(bindings)) {
        for (const el of bindings.elements) {
          used.add((el.propertyName ?? el.name).text)
        }
      }
    }
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal) &&
      reachesDomain(file, node.argument.literal.text) &&
      node.qualifier
    ) {
      used.add(
        ts.isIdentifier(node.qualifier)
          ? node.qualifier.text
          : node.qualifier.left.getText(sf)
      )
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return used
}

test("every export of packages/domain/src is imported somewhere", () => {
  const consumers = [
    ...["apps", "packages"].flatMap((dir) => sourceFiles(path.join(root, dir))),
    ...sourceFiles(path.join(root, "scripts")),
    ...sourceFiles(path.join(root, ".claude/skills")),
  ]
  const used = new Set()
  for (const file of consumers) {
    for (const name of importedNames(file, parse(file))) used.add(name)
  }

  const unused = []
  for (const file of sourceFiles(domainSrc)) {
    if (file === path.join(domainSrc, "index.ts")) continue
    for (const name of exportedNames(parse(file))) {
      if (!used.has(name)) {
        unused.push(
          `${name} in ${path.relative(root, file)}: nothing imports it, delete it or import it`
        )
      }
    }
  }
  assert.deepEqual(unused, [], `unused domain exports:\n${unused.join("\n")}`)
})
