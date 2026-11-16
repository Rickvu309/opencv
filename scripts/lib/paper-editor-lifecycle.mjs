import ts from "typescript"

export function detect(text, file = "rich-page.tsx") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const calls = []
  const proxies = []
  const returns = []
  function visit(node) {
    if (ts.isCallExpression(node)) calls.push(node)
    if (ts.isNewExpression(node) && node.expression.getText(source) === "Proxy")
      proxies.push(node)
    if (ts.isReturnStatement(node)) returns.push(node)
    ts.forEachChild(node, visit)
  }
  visit(source)
  const hasCall = (name) =>
    calls.some((node) => node.expression.getText(source).endsWith(name))
  const problems = []
  if (file.endsWith("rich-page.tsx")) {
    function checkMenu(node) {
      if (
        ts.isJsxSelfClosingElement(node) &&
        node.tagName.getText(source) === "RichDocumentMenu" &&
        !node.attributes.properties.some(
          (attribute) =>
            ts.isJsxAttribute(attribute) &&
            attribute.name.getText(source) === "editorAvailable" &&
            attribute.initializer?.getText(source) === "{!!editor}"
        )
      )
        problems.push("Document menu must follow editor availability")
      ts.forEachChild(node, checkMenu)
    }
    checkMenu(source)
  }
  if (file.endsWith("rich-page.tsx") && !hasCall("mountRichEditorLifecycle"))
    problems.push("Paper must mount through the document lifecycle")
  if (
    file.endsWith("rich-page.tsx") &&
    text.includes("RichTableControls") &&
    !text.includes("<RichTableControls editor={editor}")
  )
    problems.push("The table menu must follow editor availability")
  if (file.endsWith("rich-table-controls.tsx")) {
    if (hasCall("mountRichPaperEditor") || !text.includes("anchor.remove()"))
      problems.push("The table menu must release on editor teardown")
  }
  if (file.endsWith("rich-table-menu.tsx") && hasCall("mountRichPaperEditor"))
    problems.push("Toolbar, menu and shortcut handlers need a live handle")
  if (file.endsWith("rich-editor-lifecycle.ts")) {
    for (const name of [".subscribe", ".restoreSelection", ".released"])
      if (!hasCall(name)) problems.push(`Missing lifecycle operation ${name}`)
    const resetMount = calls.some(
      (node) =>
        node.expression.getText(source).endsWith(".subscribe") &&
        node.arguments.some(
          (argument) =>
            argument.getText(source).includes('change === "reset"') &&
            argument.getText(source).includes("mount()")
        )
    )
    if (!resetMount) problems.push("Canonical document resets must remount")
  }
  if (file.endsWith("rich-editor-lifecycle.ts")) {
    const searchProxy = proxies.find(
      (node) => node.arguments?.[0]?.getText(source) === "target.search"
    )
    const searchName = searchProxy?.parent
    if (
      !searchName ||
      !ts.isVariableDeclaration(searchName) ||
      !returns.some(
        (node) =>
          node.expression?.getText(source) ===
            searchName.name.getText(source) &&
          ts.isIfStatement(node.parent) &&
          node.parent.expression.getText(source) === 'key === "search"'
      )
    )
      problems.push("Search controls must use the live editor handle")
    const exposed = calls.filter((node) =>
      node.expression.getText(source).endsWith(".mounted")
    )
    if (
      !exposed.length ||
      exposed.some(
        (node) =>
          node.arguments.length !== 1 ||
          node.arguments[0].getText(source) !== "liveHandle(editor)"
      )
    )
      problems.push("Toolbar, menu and shortcut handlers need a live handle")
    const invocations = calls.filter(
      (node) => node.expression.getText(source) === "Reflect.apply"
    )
    const checked = (node) => {
      for (let at = node.parent; at; at = at.parent) {
        if (
          ts.isIfStatement(at) &&
          at.expression.getText(source) === "editor === target" &&
          node.getStart(source) >= at.thenStatement.getStart(source) &&
          node.getEnd() <= at.thenStatement.getEnd()
        )
          return true
      }
      return false
    }
    if (!invocations.length || invocations.some((node) => !checked(node)))
      problems.push("Editor calls must check the live handle at invocation")
  } else if (!file.endsWith("editor.ts") && hasCall("mountRichPaperEditor")) {
    problems.push("Toolbar, menu and shortcut handlers need a live handle")
  }
  if (file.endsWith("editor.ts")) {
    const capture = calls.find(
      (node) =>
        ts.isIdentifier(node.expression) &&
        node.expression.text === "captureEditorSelection"
    )
    let destroy = capture?.parent
    while (destroy && !ts.isBlock(destroy)) destroy = destroy.parent
    if (!destroy || !ts.isBlock(destroy))
      problems.push("Editor release must capture selection before unmount")
    else {
      const release = calls.find(
        (node) =>
          node.getStart(source) > destroy.getStart(source) &&
          node.getEnd() < destroy.getEnd() &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "onRelease"
      )
      const unmount = calls.find(
        (node) =>
          node.getStart(source) > destroy.getStart(source) &&
          node.getEnd() < destroy.getEnd() &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "unmount"
      )
      if (
        !release ||
        !unmount ||
        capture.getStart(source) > release.getStart(source) ||
        release.getStart(source) > unmount.getStart(source)
      )
        problems.push("Editor release must capture selection before unmount")
    }
  }
  return problems
}
