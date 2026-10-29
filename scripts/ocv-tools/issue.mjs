// `ocv-tools file`: builds the issue from the form fields, lints the plain words and creates it.
import { fileURLToPath } from "node:url"
import { Refused } from "./result.mjs"
import { TEMPLATE_FIELDS, TYPES } from "./fields.mjs"
import {
  PLAIN_RULE,
  buildIssueBody,
  lintIssue,
  parseRisk,
  splitIssues,
} from "./lint.mjs"

// Model issues live in one file so the writing guide and the tests show the same ones.
export const EXAMPLES = fileURLToPath(new URL("./examples.md", import.meta.url))

export function exampleIssues(text) {
  return splitIssues(text)
}

const TITLE_PREFIX = new RegExp(`^(${TYPES.join("|")}): `)

// The title carries the type prefix. `--type` adds it when the title has none.
export function titleWithType(title, type) {
  if (TITLE_PREFIX.test(title)) return title
  if (type && TYPES.includes(type)) return `${type}: ${title}`
  throw new Refused(
    "MISSING_FIELDS",
    `the title must start with one of ${TYPES.join(", ")} and a colon, for example "fix: ..."`
  )
}

export function file(ctx, { flags }) {
  if (!flags["--title"]) throw new Refused("MISSING_FIELDS", "no --title")
  const title = titleWithType(flags["--title"], flags["--type"])
  const type = title.match(TITLE_PREFIX)[1]
  let body
  if (flags["--body-file"]) body = ctx.readFile(flags["--body-file"])
  else {
    try {
      body = buildIssueBody({
        ...Object.fromEntries(
          TEMPLATE_FIELDS.map((f) => [f.id, flags[f.flag]])
        ),
        type,
      })
    } catch (e) {
      throw new Refused("MISSING_FIELDS", e.message)
    }
  }
  const lint = lintIssue({ title, body })
  if (!lint.risk)
    lint.reasons.unshift(
      'the body has no "Risk" section with low, normal or high'
    )
  if (lint.reasons.length)
    throw new Refused("UNREADABLE", lint.reasons.join("; "))
  const grade = `Reading level: grade ${lint.grade.toFixed(1)} (aim for 6 or lower; above 8 is refused).`

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
    ],
    next:
      parseRisk(body) === "high"
        ? "Ask the owner to comment /approve on the issue before anyone takes it."
        : `scripts/ocv-tools.mjs take ${created.n}`,
  }
}
