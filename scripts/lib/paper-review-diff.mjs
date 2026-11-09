function lineOf(text, index) {
  return text.slice(0, Math.max(0, index)).split("\n").length
}

function problem(text, index = 0) {
  return { kind: "private-review-field", line: lineOf(text, index) }
}

const PRIVATE_FIELD =
  /\b(handle|reversal|packageBytes|packageByte|restore|approve|undo)\b/

function objectKeys(block) {
  return [...block.matchAll(/^\s*(\w+)\s*:/gm)].map((match) => match[1])
}

function blockFrom(text, startMark) {
  const at = text.indexOf(startMark)
  if (at === -1) return null
  const end = text.indexOf("})", at)
  if (end === -1) return null
  return { at, block: text.slice(at, end) }
}

function domainProblems(text) {
  const problems = []
  const schema = blockFrom(text, ".object({")
  if (!schema || objectKeys(schema.block).join(",") !== "target,before,after")
    problems.push(problem(text, schema?.at ?? 0))
  const built = blockFrom(text, "paperReviewReplacementSchema.safeParse({")
  if (!built || objectKeys(built.block).join(",") !== "target,before,after")
    problems.push(problem(text, built?.at ?? 0))
  else if (
    !built.block.includes("change.targetId") ||
    !built.block.includes("change.before") ||
    !built.block.includes("change.after")
  )
    problems.push(problem(text, built.at))
  if (!text.includes(".strict()")) problems.push(problem(text))
  if (!text.includes("return Object.freeze(parsed.data)"))
    problems.push(problem(text))
  if (!text.includes("return Object.freeze(replacements)"))
    problems.push(problem(text))
  if (!text.includes("export function paperReviewDiff"))
    problems.push(problem(text))
  if (/return\s+(review|change|value)\b/.test(text))
    problems.push(problem(text))
  const spread = text.indexOf("...")
  if (spread !== -1) problems.push(problem(text, spread))
  const leaked = PRIVATE_FIELD.exec(text)
  if (leaked) problems.push(problem(text, leaked.index))
  return problems
}

function apiProblems(text) {
  const problems = []
  if (!text.includes("return paperReviewDiff(review)"))
    problems.push(problem(text))
  if ((text.match(/\breturn\b/g) ?? []).length !== 1)
    problems.push(problem(text))
  const spread = text.indexOf("...")
  if (spread !== -1) problems.push(problem(text, spread))
  const leaked = PRIVATE_FIELD.exec(text)
  if (leaked) problems.push(problem(text, leaked.index))
  return problems
}

export function detect(text, file = "source.ts") {
  const base = file.split("/").pop()
  if (base === "paper-review-diff.ts") return domainProblems(text)
  if (base === "package-review-diff.ts") return apiProblems(text)
  if (base === "index.ts")
    return text.includes('export * from "./paper-review-diff.js"')
      ? []
      : [problem(text)]
  return []
}
