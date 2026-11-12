import { fileURLToPath } from "node:url"
import { TEMPLATE_FIELDS, TYPES } from "./fields.mjs"
import { decide, refusalError } from "./rules/index.mjs"
import {
  GRADE_LIMIT,
  PLAIN_RULE,
  buildIssueBody,
  issueFieldProblems,
  lintIssue,
  parseRisk,
} from "./lint.mjs"

export const EXAMPLES = fileURLToPath(
  new URL("./issue-examples.json", import.meta.url)
)

export function exampleIssues(text) {
  return JSON.parse(text)
}

const TITLE_PREFIX = new RegExp(`^(${TYPES.join("|")}): `)

export function titleWithType(title, type) {
  if (TITLE_PREFIX.test(title)) return title
  if (type && TYPES.includes(type)) return `${type}: ${title}`
  return null
}

const shellQuote = (text) => `'${String(text).replaceAll("'", `'\\''`)}'`

export const TAKE_SWITCHES = Object.freeze([
  "--resume",
  "--no-install",
  "--no-assign",
  "--take",
  "--dry-run",
])
const FILE_SWITCHES = ["--dry-run"]

function fieldArgument(field, flags, risk) {
  const given = String(flags[field.flag] ?? "").trim()
  if (field.kind === "dropdown") {
    const usable = field.options.includes(given.toLowerCase())
    if (usable) return `${field.flag} ${given.toLowerCase()}`
    return field.required
      ? `${field.flag} '<${field.options.join("|")}>'`
      : null
  }
  if (given) return `${field.flag} ${shellQuote(given)}`
  if (field.required || field.requiredForRisk === risk)
    return `${field.flag} '<${field.label}>'`
  return null
}

export function retryCommand(verb, flags, typed) {
  const title = shellQuote(flags["--title"] ?? "<title>")
  const risk = String(flags["--risk"] ?? "")
    .trim()
    .toLowerCase()
  const fields = flags["--body-file"]
    ? [`--body-file ${shellQuote(flags["--body-file"])}`]
    : TEMPLATE_FIELDS.filter((f) => f.id !== "type" || !typed).map((f) =>
        fieldArgument(f, flags, risk)
      )
  const words =
    verb === "take" && typeof flags["-d"] === "string"
      ? `-d ${shellQuote(flags["-d"])}`
      : null
  const kept = (verb === "take" ? TAKE_SWITCHES : FILE_SWITCHES).filter(
    (name) => flags[name] === true
  )
  return [
    "scripts/ocv-tools.mjs",
    verb === "take" ? `take ${title}` : `file --title ${title}`,
    words,
    ...fields,
    ...kept,
  ]
    .filter(Boolean)
    .join(" ")
}

function draftOf(ctx, flags, verb) {
  const problems = []
  const given = flags["--title"]
  const wanted = flags["--type"]
  const wrongType =
    wanted != null && !TYPES.includes(wanted) && !TITLE_PREFIX.test(given ?? "")
  const title = given ? titleWithType(given, wanted) : null
  if (wrongType)
    problems.push(`--type must be ${TYPES.join(", ")}, not "${wanted}"`)
  if (!given) problems.push("no --title")
  else if (!title && !wrongType)
    problems.push(
      `the title must start with one of ${TYPES.join(", ")} and a colon, for example "fix: ...", or pass --type`
    )
  const type = title?.match(TITLE_PREFIX)[1]
  let body
  if (flags["--body-file"]) body = ctx.readFile(flags["--body-file"])
  else {
    const values = {
      ...Object.fromEntries(TEMPLATE_FIELDS.map((f) => [f.id, flags[f.flag]])),
      type: type ?? TYPES[0],
    }
    problems.push(...issueFieldProblems(values))
    if (!problems.length) body = buildIssueBody(values)
  }
  if (problems.length)
    return {
      draft: {
        problems,
        retry: retryCommand(verb, flags, TITLE_PREFIX.test(given ?? "")),
      },
    }
  const lint = lintIssue({ title, body })
  if (!lint.risk)
    lint.reasons.unshift(
      'the body has no "Risk" section with low, normal or high'
    )
  return { draft: { reasons: lint.reasons }, title, type, body, lint }
}

export function file(ctx, { flags, verb = "file" }) {
  const { draft, title, type, body, lint } = draftOf(ctx, flags, verb)
  const verdict = decide("file", { flags, draft })
  if (!verdict.ok) throw refusalError(verdict.refusals[0])
  const grade = `Reading level: grade ${lint.grade.toFixed(1)} (aim for 6 or lower; above ${GRADE_LIMIT} gets a warning).`
  const warnings = lint.advice.map((line) => `Warning: ${line}`)

  if (flags["--dry-run"]) {
    const models = exampleIssues(ctx.ports.fs.read(EXAMPLES))
      .map((x) => `# ${x.title}\n\n${x.body}`)
      .join("\n")
    return {
      lines: [
        "DRY RUN: nothing was created.",
        "",
        title,
        "",
        body,
        grade,
        ...warnings,
        "",
        "How to write it:",
        PLAIN_RULE,
        "",
        "Model issues to copy:",
        "",
        models,
      ],
      next: "Run the same command without --dry-run to create the issue.",
    }
  }

  const open = ctx.ports.gh
    .openIssues()
    .find((i) => i.title.trim().toLowerCase() === title.trim().toLowerCase())
  if (open)
    return {
      lines: [`ALREADY FILED: #${open.number} has this title and is open.`],
      next: `scripts/ocv-tools.mjs status ${open.number}`,
    }

  const bodyPath = ctx.writeScratch(`issue-body-${process.pid}.md`, body)
  const created = ctx.ports.gh.createIssue({
    title,
    bodyPath,
    labels: [`risk:${parseRisk(body)}`, type],
  })
  return {
    lines: [
      `FILED #${created.n}: ${title}`,
      created.url,
      `Label: risk:${parseRisk(body)}. ${grade}`,
      ...warnings,
    ],
    warnings,
    next: `scripts/ocv-tools.mjs take ${created.n}`,
  }
}
