import ts from "typescript"

function nodes(source, predicate) {
  const found = []
  const visit = (node) => {
    if (predicate(node)) found.push(node)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

function calls(source, name) {
  return nodes(
    source,
    (node) => ts.isCallExpression(node) && node.expression.getText() === name
  )
}

function body(source, name) {
  return nodes(
    source,
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name
  )[0]?.body
}

export function qualifiedNativeWord(text, path) {
  if (path !== "apps/api/src/paper/native-word.ts") return false
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const entry = body(source, "downloadNativeWord")
  if (!entry) return false
  const snapshots = calls(entry, "withRichSnapshot")
  const callback = snapshots[0]?.arguments[2]
  const compilations = calls(source, "compileOwnedFlowNativeDocx")
  return (
    snapshots.length === 1 &&
    callback &&
    ts.isArrowFunction(callback) &&
    snapshots[0].arguments[0]?.getText() === "userId" &&
    snapshots[0].arguments[1]?.getText() === "input" &&
    callback.parameters[0]?.name.getText() === "snapshot" &&
    callback.getText().includes("snapshot.document") &&
    compilations.length === 1 &&
    calls(callback, "compileOwnedFlowNativeDocx")[0] === compilations[0] &&
    source.statements.some(
      (node) =>
        ts.isImportDeclaration(node) &&
        node.moduleSpecifier.text === "./content-store.js" &&
        node.importClause?.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings) &&
        node.importClause.namedBindings.elements.some(
          (item) => !item.propertyName && item.name.text === "withRichSnapshot"
        )
    )
  )
}

export function detect(text, path) {
  const hits = []
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  if (path === "apps/web/src/lib/paper-rich-word.ts") {
    const entry = body(source, "downloadSavedRichWord")
    const delayed =
      entry &&
      calls(entry, "setTimeout").some((call) => {
        const callback = call.arguments[0]
        return (
          callback &&
          ts.isArrowFunction(callback) &&
          calls(callback, "URL.revokeObjectURL").length === 1 &&
          call.arguments[1] &&
          ts.isNumericLiteral(call.arguments[1]) &&
          Number(call.arguments[1].text) >= 1000
        )
      })
    if (!delayed)
      hits.push(
        "Word downloads must retain the file URL until the browser can start saving"
      )
    const started =
      entry &&
      nodes(
        entry,
        (node) =>
          ts.isIfStatement(node) && node.expression.getText() === "triggered"
      )[0]?.thenStatement
    if (
      !started ||
      calls(started, "URL.revokeObjectURL").length !== 1 ||
      calls(started, "clearTimeout").some(
        (clear) =>
          !calls(started, "setTimeout").some(
            (timer) =>
              timer.arguments[0] &&
              calls(timer.arguments[0], "clearTimeout").includes(clear)
          )
      ) ||
      calls(started, "signal.addEventListener").length ||
      nodes(started, ts.isIfStatement).length
    )
      hits.push(
        "A started Word download must retain its URL even when its session aborts"
      )
    const decode = calls(source, "decodeURIComponent")
    if (
      decode.some(
        (call) =>
          !nodes(source, ts.isTryStatement).some(
            (attempt) =>
              attempt.catchClause &&
              calls(attempt.tryBlock, "decodeURIComponent").includes(call)
          )
      )
    )
      hits.push(
        "Malformed Word filenames must fall back without stopping the download"
      )
    if (
      !nodes(source, ts.isCallExpression).some(
        (call) =>
          ts.isPropertyAccessExpression(call.expression) &&
          call.expression.name.text === "toLowerCase" &&
          call.expression.expression.getText().includes('"content-type"')
      )
    )
      hits.push("Word media types must be compared without case sensitivity")
  }
  if (path === "apps/web/src/features/paper/rich-document-menu.tsx") {
    if (
      !text.includes("error instanceof SavedRichWordChanged") ||
      !text.includes("toast.loading(") ||
      !text.includes("toast.success(")
    )
      hits.push(
        "Word downloads must resolve visible progress and distinguish changed documents from preparation failures"
      )
    if (
      !text.includes("aria-describedby=") ||
      !text.includes('status === "refused"') ||
      !text.includes('status === "stuck"')
    )
      hits.push(
        "Disabled Word downloads must describe their actual blocked state"
      )
  }
  if (path === "apps/api/src/app.ts") {
    const options = calls(source, "cors")[0]?.arguments[0]
    const headers = (name) => {
      if (!options || !ts.isObjectLiteralExpression(options)) return []
      const property = options.properties.find(
        (node) => ts.isPropertyAssignment(node) && node.name.getText() === name
      )
      if (!property || !ts.isArrayLiteralExpression(property.initializer))
        return []
      return property.initializer.elements
        .filter(ts.isStringLiteral)
        .map((node) => node.text.toLowerCase())
    }
    if (
      !["x-paper-writer", "x-paper-basis"].every((name) =>
        headers("allowHeaders").includes(name)
      ) ||
      !["x-paper-basis", "content-disposition"].every((name) =>
        headers("exposeHeaders").includes(name)
      )
    )
      hits.push(
        "Word downloads must allow their exact basis and expose the qualified basis and filename across origins"
      )
  }
  if (
    path === "packages/domain/src/paper-doc/native-layout-flow.ts" &&
    (!text.includes("paperPhotoFileId(node.photo)") ||
      !text.includes(".map(withoutHeaderPortrait)"))
  )
    hits.push(
      "Flow validation must retain owned CV portraits while projecting older layout validation"
    )
  if (
    path === "apps/api/src/paper/native-word.ts" &&
    !qualifiedNativeWord(text, path)
  )
    hits.push(
      "Rich Word compilation must remain inside the exact owned snapshot"
    )
  if (path === "apps/api/src/paper/content-store.ts") {
    const snapshot = body(source, "withRichSnapshot")
    if (
      snapshot &&
      (!calls(snapshot, "ownedTaskTransaction").length ||
        !calls(snapshot, "lockedRow").length ||
        !calls(snapshot, "qualifyRichDocument").length ||
        !calls(snapshot, "hydrate").length ||
        !calls(snapshot, "qualifyRichSnapshot").length ||
        !calls(snapshot, "entry.yDoc.destroy").length)
    )
      hits.push(
        "Word snapshots must own the transaction, lock, admit, hydrate, qualify and release their detached document"
      )
  }
  if (path === "apps/api/src/paper/native-output/formatted-owned.ts") {
    const compiler = body(source, "compileOwnedFlowNativeDocx")
    if (
      compiler &&
      (!calls(compiler, "insideTransaction").length ||
        !compiler.getText().includes("sources.add(node.photo)") ||
        !compiler.getText().includes("sources.add(node.source)") ||
        !calls(compiler, "readOwnedPhoto").every((call) =>
          call.arguments[2]?.getText().match(/lock:\s*true/)
        ))
    )
      hits.push(
        "Flow Word output must resolve locked owned photos in both semantic headers and content"
      )
  }
  if (path === "apps/api/src/paper/store.ts") {
    const reader = body(source, "readOwnedPhoto")
    if (
      reader &&
      (calls(reader, "requireAvatarFile").length ||
        !reader.getText().includes("purpose: files.purpose") ||
        !reader.getText().includes("bytes: files.bytes") ||
        !calls(reader, "query.for").some(
          (call) => call.arguments[0]?.getText() === '"share"'
        ))
    )
      hits.push(
        "Photo purpose, media type and bytes must come from the same owned read with a snapshot lock option"
      )
  }
  return hits
}
