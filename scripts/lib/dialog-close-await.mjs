import ts from "typescript"

export function detect(text, file = "test.tsx") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const problems = []

  function visit(node) {
    if (ts.isBlock(node)) {
      for (let index = 1; index < node.statements.length; index++) {
        const previous = node.statements[index - 1].getText(source)
        const statement = node.statements[index]
        const assertion = statement.getText(source)
        if (
          /^fireEvent\.(?:click|keyDown)\(/.test(previous) &&
          /^expect\(/.test(assertion) &&
          /\.queryByRole\(\s*["']dialog["']/.test(assertion) &&
          /\)\s*\.not\.toBeInTheDocument\(\)/.test(assertion)
        ) {
          const line =
            source.getLineAndCharacterOfPosition(statement.getStart(source))
              .line + 1
          problems.push(
            `${file}:${line}: wait for dialog removal after closing it with await waitFor; exit completion can be asynchronous.`
          )
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return problems
}
