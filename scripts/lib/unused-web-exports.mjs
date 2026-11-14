import path from "node:path"
import ts from "typescript"

const TEST_ONLY = /\.(?:test|type-test|fixtures)\.|\/(?:test|tests|__tests__)\//

export function unusedWebExports(files) {
  const sources = new Map(
    files.map(({ path: file, text }) => [
      path.posix.resolve("/", file),
      ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true),
    ])
  )
  const host = {
    fileExists: (file) => sources.has(file),
    readFile: (file) => sources.get(file)?.text,
    getSourceFile: (file) => sources.get(file),
    getDefaultLibFileName: () => "",
    writeFile: () => {},
    getCurrentDirectory: () => "/",
    getDirectories: () => [],
    directoryExists: (dir) =>
      [...sources.keys()].some((file) => file.startsWith(`${dir}/`)),
    getCanonicalFileName: (file) => file,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  }
  const program = ts.createProgram(
    [...sources.keys()],
    {
      noLib: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      paths: { "@/*": ["/apps/web/src/*"] },
    },
    host
  )
  const checker = program.getTypeChecker()
  const candidates = new Map()
  for (const source of program.getSourceFiles()) {
    if (TEST_ONLY.test(source.fileName) || source.fileName.endsWith(".d.ts"))
      continue
    for (const statement of source.statements) {
      const modifiers = statement.modifiers ?? []
      if (
        !modifiers.some((item) => item.kind === ts.SyntaxKind.ExportKeyword) ||
        modifiers.some((item) => item.kind === ts.SyntaxKind.DefaultKeyword)
      )
        continue
      const names = ts.isVariableStatement(statement)
        ? statement.declarationList.declarations.map((item) => item.name)
        : [statement.name]
      for (const name of names) {
        if (!name || !ts.isIdentifier(name)) continue
        const symbol = checker.getSymbolAtLocation(name)
        if (symbol) candidates.set(symbol, { source, name, used: false })
      }
    }
  }
  function keepModule(node) {
    const symbol = checker.getSymbolAtLocation(node)
    if (!symbol) return
    for (const exported of checker.getExportsOfModule(symbol)) {
      const target =
        exported.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(exported)
          : exported
      const candidate = candidates.get(target)
      if (candidate) candidate.used = true
    }
  }
  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.namedBindings &&
      ts.isNamespaceImport(node.importClause.namedBindings)
    )
      keepModule(node.moduleSpecifier)
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0]
    )
      keepModule(node.arguments[0])
    if (ts.isIdentifier(node)) {
      let symbol = ts.isShorthandPropertyAssignment(node.parent)
        ? checker.getShorthandAssignmentValueSymbol(node.parent)
        : checker.getSymbolAtLocation(node)
      if (symbol?.flags & ts.SymbolFlags.Alias)
        symbol = checker.getAliasedSymbol(symbol)
      const candidate = candidates.get(symbol)
      if (candidate && candidate.name !== node) candidate.used = true
    }
    ts.forEachChild(node, visit)
  }
  for (const source of program.getSourceFiles()) visit(source)
  return [...candidates.values()]
    .filter(({ used }) => !used)
    .map(({ source, name }) => ({
      path: source.fileName.replace(/^\//, ""),
      name: name.text,
      line: source.getLineAndCharacterOfPosition(name.getStart()).line + 1,
    }))
    .sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line)
}
