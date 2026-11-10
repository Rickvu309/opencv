import { RISKS, TEMPLATE_FIELDS } from "./fields.mjs"

const EXEMPT = new Set(
  TEMPLATE_FIELDS.filter((f) => f.exempt).map((f) => f.label.toLowerCase())
)
const label = (id) => TEMPLATE_FIELDS.find((f) => f.id === id).label
const RISK_HEADING = label("risk").toLowerCase()
const DONE_HEADING = label("done").toLowerCase()
const REQUIRED_SECTIONS = TEMPLATE_FIELDS.filter((f) => f.required).map((f) =>
  f.label.toLowerCase()
)

export const PLAIN_LIMIT = 2500
export const DONE_LIMIT = 6
export const SENTENCE_LIMIT = 20
export const GRADE_LIMIT = 8

const JARGON = [
  "api",
  "endpoint",
  "worker",
  "webhook",
  "idempotent",
  "refactor",
  "middleware",
  "lint",
  "rebase",
  "sha",
  "ci",
  "pr",
  "dns",
  "gate",
  "worktree",
  "repo",
  "token",
  "tokens",
  "deploy",
  "commit",
  "config",
  "schema",
  "branch",
  "hook",
  "hooks",
  "ssr",
  "regex",
]
export const TITLE_EVERYDAY = ["ci", "pr", "api"]
const VAGUE = [
  "clear",
  "clearer",
  "clearly",
  "easy",
  "easier",
  "better",
  "tidy",
  "tidier",
  "nice",
  "nicer",
  "properly",
  "improve",
  "improved",
  "simple",
  "simpler",
  "cleaner",
  "readable",
  "plainer",
]
const PATHY = [
  /\b[\w.-]+\.(?:mjs|cjs|js|ts|tsx|jsx|json|jsonc|md|yml|yaml|css|html|sh)\b/i,
  /\b(?:src|apps|packages|scripts|test|tests|docs|node_modules)\//i,
  /(?:^|\s)\.[a-z]+\//i,
]

export const PLAIN_RULE = `Write it like one person talking to another. Short sentences (under ${SENTENCE_LIMIT} words), everyday words, one idea per sentence. Say what changes for the owner and how they will see it, not how the code works. Never present your own choices as the owner's; ask under "Questions for you" instead. Every "Done when" line names something the owner can see or try, at most ${DONE_LIMIT} lines. No backticks and no file names. Jargon, a long sentence or a reading grade above ${GRADE_LIMIT} gets a warning, not a refusal. A title may use CI, PR and API. Keep technical notes under "Details for the agent".`

function plainSections(body) {
  return String(body ?? "")
    .split(/^###[ \t]+/m)
    .slice(1)
    .map((part) => {
      const [heading, ...rest] = part.split(/\r?\n/)
      return { heading: heading.trim(), text: rest.join("\n").trim() }
    })
}

function sentences(text) {
  return String(text ?? "")
    .split(/(?<=[.!?])\s+|\n/)
    .map((x) => x.trim().replace(/^- /, ""))
    .filter(Boolean)
}

function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, "")
  if (!w) return 0
  if (w.length <= 3) return 1
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "")
  const m = w.match(/[aeiouy]{1,2}/g)
  return Math.max(1, m ? m.length : 1)
}

export function readingGrade(text) {
  const sents = sentences(text)
  const words = String(text ?? "")
    .split(/\s+/)
    .filter((w) => /[a-z]/i.test(w))
  if (!words.length || !sents.length) return 0
  const syl = words.reduce((n, w) => n + syllables(w), 0)
  return (
    0.39 * (words.length / sents.length) + 11.8 * (syl / words.length) - 15.59
  )
}

export function parseRisk(body) {
  const section = plainSections(body).find(
    (x) => x.heading.toLowerCase() === RISK_HEADING
  )
  const word = section?.text.split(/\s+/)[0]?.toLowerCase()
  return RISKS.includes(word) ? word : null
}

const wordCount = (s) => s.split(/\s+/).filter(Boolean).length
const inChecked = (issue, fn) =>
  issue.checked.flatMap(({ heading, text }) => fn(heading, text))

const CHECKS = [
  {
    id: "sections",
    run: ({ headings, risk, bodies }) => {
      const need = [...REQUIRED_SECTIONS]
      for (const f of TEMPLATE_FIELDS)
        if (f.requiredForRisk === risk) need.push(f.label.toLowerCase())
      return need
        .filter((n) => n !== "type" && !headings.includes(n))
        .map((n) => `missing the "${n}" section`)
        .concat(
          need
            .filter((n) => n !== "type" && headings.includes(n))
            .filter((n) => {
              const text = bodies[n] ?? ""
              return !text || /^_no response_$/i.test(text)
            })
            .map((n) => `the "${n}" section is empty`)
        )
    },
  },
  {
    id: "code",
    run: (i) =>
      inChecked(i, (h, t) =>
        t.includes("`")
          ? [
              `"${h}" has code formatting; say it in plain words or move it to "Details for the agent"`,
            ]
          : []
      ),
  },
  {
    id: "paths",
    run: (i) =>
      inChecked(i, (h, t) => {
        const hit = PATHY.map((re) => re.exec(t)?.[0]).find(Boolean)
        return hit
          ? [
              `"${h}" names a file or folder ("${hit.trim()}"); move it to "Details for the agent"`,
            ]
          : []
      }),
  },
  {
    id: "jargon",
    advice: true,
    run: (i) =>
      inChecked(i, (h, t) =>
        JARGON.filter(
          (w) =>
            !(h === "title" && TITLE_EVERYDAY.includes(w)) &&
            new RegExp(`\\b${w}(?:s|es|ed|ing|ment|ments)?\\b`, "i").test(t)
        ).map(
          (w) => `"${h}" uses the jargon word "${w}"; say it in plain words`
        )
      ),
  },
  {
    id: "length",
    run: (i) => {
      const length = i.checked.reduce((n, x) => n + x.text.length, 0)
      return length > PLAIN_LIMIT
        ? [
            `the plain sections are ${length} characters; keep them under ${PLAIN_LIMIT}`,
          ]
        : []
    },
  },
  {
    id: "done-count",
    run: ({ done }) =>
      done.length > DONE_LIMIT
        ? [
            `"Done when" has ${done.length} lines; keep it to ${DONE_LIMIT} or fewer, or split the work into two issues`,
          ]
        : [],
  },
  {
    id: "done-vague",
    run: ({ done }) => {
      const word = VAGUE.find((w) =>
        done.some((line) => new RegExp(`\\b${w}\\b`, "i").test(line))
      )
      return word
        ? [`"Done when" says "${word}"; say what the owner will see instead`]
        : []
    },
  },
  {
    id: "long-sentence",
    advice: true,
    run: (i) =>
      inChecked(i, (h, t) =>
        sentences(t)
          .filter((s) => wordCount(s) > SENTENCE_LIMIT)
          .map(
            (s) =>
              `"${h}" has a ${wordCount(s)}-word sentence (limit ${SENTENCE_LIMIT}); split it`
          )
      ),
  },
  {
    id: "reading-level",
    advice: true,
    run: ({ grade }) =>
      grade > GRADE_LIMIT
        ? [
            `the plain sections read at grade ${grade.toFixed(1)}; aim for 6 or lower, and keep it at ${GRADE_LIMIT} or lower`,
          ]
        : [],
  },
]

export function lintIssue({ title, body }) {
  const sections = plainSections(body)
  const preamble = String(body ?? "")
    .split(/^###[ \t]+/m)[0]
    .trim()
  if (preamble) sections.unshift({ heading: "intro", text: preamble })
  const risk = parseRisk(body)
  const live = sections.filter((x) => !EXEMPT.has(x.heading.toLowerCase()))
  const checked = [
    { heading: "title", text: String(title ?? "").replace(/^[a-z]+:\s*/, "") },
    ...live.filter((x) => x.heading.toLowerCase() !== RISK_HEADING),
  ]
  const done = (
    sections.find((x) => x.heading.toLowerCase() === DONE_HEADING)?.text ?? ""
  )
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const grade = readingGrade(
    checked
      .slice(1)
      .map((x) => x.text)
      .join("\n")
  )
  const issue = {
    headings: sections.map((x) => x.heading.toLowerCase()),
    bodies: Object.fromEntries(
      sections.map((x) => [x.heading.toLowerCase(), x.text])
    ),
    checked,
    done,
    risk,
    grade,
  }
  const reasons = []
  const advice = []
  const failed = []
  for (const check of CHECKS) {
    const found = check.run(issue)
    if (!found.length) continue
    failed.push(check.id)
    if (check.advice) advice.push(...found)
    else reasons.push(...found)
  }
  return { ok: reasons.length === 0, reasons, advice, failed, grade, risk }
}

export function issueFieldProblems(values) {
  const blank = (f) => !String(values[f.id] ?? "").trim()
  const problems = []
  const missing = TEMPLATE_FIELDS.filter((f) => f.required && blank(f)).map(
    (f) => f.flag
  )
  if (missing.length) problems.push(`missing ${missing.join(", ")}`)
  for (const f of TEMPLATE_FIELDS.filter((x) => x.kind === "dropdown")) {
    if (blank(f)) continue
    const v = String(values[f.id]).trim().toLowerCase()
    if (!f.options.includes(v))
      problems.push(
        `${f.flag} must be ${f.options.join(", ")}, not "${values[f.id]}"`
      )
  }
  const risk = String(values.risk ?? "")
    .trim()
    .toLowerCase()
  for (const f of TEMPLATE_FIELDS)
    if (f.requiredForRisk === risk && blank(f))
      problems.push(`missing ${f.flag} (required when risk is ${risk})`)
  return problems
}

export function buildIssueBody(values) {
  const problems = issueFieldProblems(values)
  if (problems.length) throw new Error(problems.join("; "))
  return (
    TEMPLATE_FIELDS.map((f) => [
      f,
      f.kind === "dropdown"
        ? String(values[f.id]).trim().toLowerCase()
        : String(values[f.id] ?? "").trim(),
    ])
      .filter(([, text]) => text)
      .map(([f, text]) => `### ${f.label}\n\n${text}`)
      .join("\n\n") + "\n"
  )
}

export function splitIssues(text) {
  return String(text ?? "")
    .split(/^# /m)
    .slice(1)
    .map((chunk) => {
      const [title, ...rest] = chunk.split(/\r?\n/)
      return { title: title.trim(), body: `${rest.join("\n").trim()}\n` }
    })
}
