function evaluate(source, event, result) {
  const pattern =
    /\s+|github\.event_name\b|needs\.full\.result\b|always\b|success\b|failure\b|cancelled\b|true\b|false\b|'[^']*'|"[^"]*"|&&|\|\||==|!=|[!()]/y
  const tokens = []
  while (pattern.lastIndex < source.length) {
    const match = pattern.exec(source)
    if (!match) throw new Error("unsupported approval condition")
    if (match[0].trim()) tokens.push(match[0])
  }
  let position = 0
  const take = (token) => tokens[position] === token && ++position
  const atom = () => {
    if (take("!")) return !atom()
    if (take("(")) {
      const value = or()
      if (!take(")")) throw new Error("missing closing parenthesis")
      return value
    }
    const token = tokens[position++]
    if (token === "github.event_name") return event
    if (token === "needs.full.result") return result
    if (["always", "success", "failure", "cancelled"].includes(token)) {
      if (!take("(") || !take(")")) throw new Error("invalid status function")
      return (
        token === "always" ||
        (token === "success" ? result === "success" : result === token)
      )
    }
    if (token === "true" || token === "false") return token === "true"
    if (/^['"]/.test(token ?? "")) return token.slice(1, -1).toLowerCase()
    throw new Error("unsupported approval operand")
  }
  const equal = () => {
    let value = atom()
    while (["==", "!="].includes(tokens[position])) {
      const operator = tokens[position++]
      const right = atom()
      value = operator === "==" ? value === right : value !== right
    }
    return value
  }
  const and = () => {
    let value = equal()
    while (take("&&")) {
      const right = equal()
      value = value && right
    }
    return value
  }
  const or = () => {
    let value = and()
    while (take("||")) {
      const right = and()
      value = value || right
    }
    return value
  }
  const value = or()
  if (position !== tokens.length)
    throw new Error("trailing approval expression")
  return Boolean(value)
}

export function detect(text, file) {
  if (!String(file).endsWith(".github/workflows/nightly.yml")) return []
  const block =
    /^  approve-railway:\s*\n([\s\S]*?)(?=^  [\w-]+:|$(?![\s\S]))/m.exec(
      text
    )?.[1]
  if (!block) return ["approval job is missing"]
  const needs = /^    needs:([^\n]*)(?:\n((?:      -[^\n]*\n)*))?/m.exec(block)
  const dependencies =
    `${needs?.[1] ?? ""} ${needs?.[2] ?? ""}`.match(/\w[\w-]*/g) ?? []
  if (dependencies.length !== 1 || dependencies[0] !== "full")
    return ["approval must depend on full"]
  const raw = /^    if: (.+)$/m.exec(block)?.[1]?.trim() ?? ""
  const unquoted = /^["']/.test(raw) ? raw.slice(1, -1) : raw
  const condition = unquoted.replace(/^\$\{\{\s*|\s*\}\}$/g, "")
  try {
    for (const event of [
      "push",
      "schedule",
      "workflow_dispatch",
      "pull_request",
      "merge_group",
    ])
      for (const result of ["success", "failure", "cancelled", "skipped"])
        if (
          evaluate(condition, event, result) !==
          (event === "push" && result === "success")
        )
          return ["approval must run only after a successful push full"]
  } catch {
    return ["approval condition cannot be verified"]
  }
  return []
}
