import ts from "typescript"

export function detect(text, file = "delegate-policy.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const policy = source.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) && node.name?.text === "delegateAllowed"
  )
  if (!policy) return [{ line: 1, kind: "missing-delegate-filter" }]
  const hits = []
  try {
    const javascript = ts.transpileModule(
      policy.getText(source).replace("export ", ""),
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      }
    ).outputText
    const allowed = new Function(`${javascript}; return delegateAllowed`)()
    const actor = {
      type: "delegate",
      userId: "person",
      connectionId: "connection",
      resources: "jobs-and-paper",
      reads: "allow",
      writes: "approval",
      scopes: [
        "job.read",
        "job.write",
        "paper.read",
        "paper.write",
        "activity.read",
        "activity.write",
        "inbox.read",
        "inbox.write",
        "account.read",
        "account.write",
        "connection.status",
      ],
    }
    for (const name of ["activity.undo", "inbox.send", "account.delete"]) {
      const resource = name.split(".")[0]
      for (const coach of [true, "auto", "confirm", "never"]) {
        for (const delegate of [
          undefined,
          { resource, access: "read" },
          { resource, access: "proposal" },
        ]) {
          if (allowed({ name, coach, delegate }, actor))
            hits.push({ line: 1, kind: `delegate-can-use-${name}` })
        }
      }
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
  return hits
}
