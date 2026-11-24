const APPROVAL_SCRIPT = "node scripts/approve-railway-deploys.mjs"

const EVENTS = [
  "push",
  "schedule",
  "workflow_dispatch",
  "pull_request",
  "merge_group",
]

const REFS = [
  "refs/heads/main",
  "refs/heads/feature",
  "refs/pull/1/merge",
  "refs/heads/gh-readonly-queue/main/pr-1-abc",
]

const CI_RESULTS = ["success", "failure", "cancelled", "skipped"]

const STATUS_FUNCTIONS = ["always", "success", "failure", "cancelled"]

function evaluate(source, { event, ref, result }) {
  const pattern =
    /\s+|github\.event_name\b|github\.ref\b|needs\.ci\.result\b|always\b|success\b|failure\b|cancelled\b|true\b|false\b|'[^']*'|"[^"]*"|&&|\|\||==|!=|[!()]/y
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
    if (token === "github.ref") return ref
    if (token === "needs.ci.result") return result
    if (STATUS_FUNCTIONS.includes(token)) {
      if (!take("(") || !take(")")) throw new Error("invalid status function")
      return token === "always" || result === token
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
  const statusChecked = tokens.some((token) => STATUS_FUNCTIONS.includes(token))
  return Boolean(value) && (statusChecked || result === "success")
}

function jobBlock(text, name) {
  return new RegExp(
    `^  ${name}:\\s*\\n([\\s\\S]*?)(?=^  [\\w-]+:|$(?![\\s\\S]))`,
    "m"
  ).exec(text)?.[1]
}

function dependenciesOf(block) {
  const needs = /^    needs:([^\n]*)(?:\n((?:      -[^\n]*\n)*))?/m.exec(block)
  return `${needs?.[1] ?? ""} ${needs?.[2] ?? ""}`.match(/\w[\w-]*/g) ?? []
}

function conditionOf(block) {
  const raw = /^    if: (.+)$/m.exec(block)?.[1]?.trim() ?? ""
  const unquoted = /^["']/.test(raw) ? raw.slice(1, -1) : raw
  return unquoted.replace(/^\$\{\{\s*|\s*\}\}$/g, "")
}

function approvesOnlyGreenMainPush(condition) {
  for (const event of EVENTS)
    for (const ref of REFS)
      for (const result of CI_RESULTS) {
        const wanted =
          event === "push" && ref === "refs/heads/main" && result === "success"
        if (evaluate(condition, { event, ref, result }) !== wanted) return false
      }
  return true
}

export function detect(text, file) {
  const path = String(file)
  if (path.endsWith(".github/workflows/nightly.yml"))
    return text.includes(APPROVAL_SCRIPT)
      ? ["approval must run in ci.yml after the ci job, not in nightly.yml"]
      : []
  if (!path.endsWith(".github/workflows/ci.yml")) return []
  const block = jobBlock(text, "approve-railway")
  if (!block || !block.includes(APPROVAL_SCRIPT))
    return ["approval job is missing"]
  const hits = []
  if (!dependenciesOf(block).includes("ci"))
    hits.push("approval must wait for the ci job")
  if (!/^      GITHUB_SHA: \$\{\{ github\.sha \}\}$/m.test(block))
    hits.push("approval must name the commit this run tested")
  try {
    if (!approvesOnlyGreenMainPush(conditionOf(block)))
      hits.push("approval must run only on a push to main after ci succeeded")
  } catch {
    hits.push("approval condition cannot be verified")
  }
  return hits
}
