// The generated rules block in docs/git-workflow/rule-enforcement.md.
import { fileURLToPath } from "node:url"
import { RULES } from "./table.mjs"

export const BEGIN = "<!-- rules:begin -->"
export const END = "<!-- rules:end -->"
export const RULES_DOC = fileURLToPath(
  new URL("../../../docs/git-workflow/rule-enforcement.md", import.meta.url)
)

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

export function renderRulesDoc(table = RULES) {
  const lines = [
    "| rule | what makes it fail | fix | jobs |",
    "| --- | --- | --- | --- |",
  ]
  for (const row of table) {
    const rule = row.section ? `${row.id} (${row.section})` : row.id
    const fail =
      row.kind === "judgment" ? `${row.says} ${row.why ?? ""}`.trim() : row.says
    const fix = row.kind === "judgment" ? "Nothing" : row.fix({})
    const jobs =
      row.kind === "judgment" || row.jobs.length === 0
        ? "Nothing"
        : row.jobs.join(", ")
    lines.push(
      `| ${cell(rule)} | ${cell(fail)} | ${cell(fix)} | ${cell(jobs)} |`
    )
  }
  return lines.join("\n")
}

export function applyRulesDoc(text, table = RULES) {
  const block = `${BEGIN}\n${renderRulesDoc(table)}\n${END}`
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
