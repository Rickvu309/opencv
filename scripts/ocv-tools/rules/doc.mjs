// The generated rules block in docs/git-workflow/rule-enforcement.md.
import { fileURLToPath } from "node:url"
import { RULES, jobRows, layerOf } from "./index.mjs"

const BEGIN = "<!-- rules:begin -->"
const END = "<!-- rules:end -->"
export const RULES_DOC = fileURLToPath(
  new URL("../../../docs/git-workflow/rule-enforcement.md", import.meta.url)
)

// Keep the workflow, finish-and-merge and hook tables in separate guides under the file limit.
const isHook = (row) => row.at.includes("commit") || row.at.includes("push")
const guide = (name) =>
  fileURLToPath(new URL(`../../../docs/git-workflow/${name}`, import.meta.url))

export const RULE_GUIDES = [
  {
    path: RULES_DOC,
    table: RULES.filter((row) => !jobRows.includes(row) && !isHook(row)),
  },
  {
    path: guide("delivery-rules.md"),
    table: RULES.filter((row) => jobRows.includes(row)),
  },
  {
    path: guide("hook-rules.md"),
    table: RULES.filter(isHook),
  },
]

const cell = (value) =>
  String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ")

// Prettier pads the committed table. Compare cells, not column width.
function rowCells(line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith("|")) return null
  const cells = []
  let current = ""
  for (let i = 1; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (ch === "\\" && trimmed[i + 1] === "|") {
      current += "\\|"
      i++
      continue
    }
    if (ch === "|") {
      cells.push(current.trim().replace(/ +/g, " "))
      current = ""
      continue
    }
    current += ch
  }
  if (current.trim() !== "") return null
  return cells
}

function normalizeTable(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cells = rowCells(line)
      if (!cells) return line.replace(/ +/g, " ")
      if (cells.every((item) => /^:?-+:?$/.test(item)))
        return `|${cells.map(() => "---").join("|")}|`
      return `|${cells.join("|")}|`
    })
    .join("\n")
}

function markedBlock(text) {
  const begin = text.indexOf(BEGIN)
  const end = text.indexOf(END)
  if (begin === -1 || end === -1 || end < begin) return null
  return text.slice(begin + BEGIN.length, end)
}

const widthOf = (text) => [...text].length

function alignTable(rows) {
  const widths = rows[0].map((_, column) =>
    Math.max(3, ...rows.map((row) => widthOf(row[column])))
  )
  const line = (cells) =>
    `| ${cells.map((text, column) => text + " ".repeat(widths[column] - widthOf(text))).join(" | ")} |`
  const [head, ...body] = rows
  return [
    line(head),
    `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`,
    ...body.map(line),
  ].join("\n")
}

export function renderRulesDoc(table = RULES) {
  const rows = [
    ["rule", "what makes it fail", "fix", "at", "holds against main"],
  ]
  for (const row of table) {
    const rule = row.section ? `${row.id} (${row.section})` : row.id
    const fail =
      row.kind === "judgment" ? `${row.says} ${row.why ?? ""}`.trim() : row.says
    const fix = row.kind === "judgment" ? "Nothing" : row.fix({})
    const at =
      row.kind === "judgment" || row.at.length === 0
        ? "Nothing"
        : row.at.join(", ")
    const held = layerOf(row) === "server" ? "yes" : "no"
    rows.push([cell(rule), cell(fail), cell(fix), cell(at), held])
  }
  return alignTable(rows)
}

export function applyRulesDoc(text, table = RULES) {
  const block = `${BEGIN}\n\n${renderRulesDoc(table)}\n\n${END}`
  const begin = text.indexOf(BEGIN)
  const end = text.indexOf(END)
  if (begin === -1 || end === -1 || end < begin) {
    const at = text.indexOf("\n\n")
    const next =
      at === -1
        ? `${text}\n${block}\n`
        : `${text.slice(0, at + 2)}${block}\n${text.slice(at + 2)}`
    return { text: next, ok: false, missing: true }
  }
  const next = text.slice(0, begin) + block + text.slice(end + END.length)
  return { text: next, ok: rulesDocMatches(text, table), missing: false }
}

export function rulesDocMatches(text, table = RULES) {
  const block = markedBlock(text)
  if (block == null) return false
  return normalizeTable(block) === normalizeTable(renderRulesDoc(table))
}
