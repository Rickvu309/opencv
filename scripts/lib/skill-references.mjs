import path from "node:path"

const RULE_ID = /\b([A-Z]\d{1,2})\b/g
const RULE_ROW = /^\| ([A-Z]\d{1,2}) +\|/gm
const CODE_SPAN = /`([^`\n]+)`/g
const RELATIVE_LINK = /\]\((\.\.?\/[^)\s#]+)(?:#[^)]*)?\)/g
const REPO_PATH =
  /^(?:\.\/)?((?:scripts|packages|apps|docs|\.agents|\.github)\/[^<>*{}|]+?)(?::\d+)?[.,;]?$/

const isReference = (file) => file.path.includes("/references/")

const unique = (values) => [...new Set(values)]

export function ruleRows(files) {
  return new Set(
    files
      .filter(isReference)
      .flatMap((file) => [...file.text.matchAll(RULE_ROW)].map((m) => m[1]))
  )
}

export function citedRules(text) {
  return unique([...text.matchAll(RULE_ID)].map((match) => match[1]))
}

export function namedPaths(file) {
  const spans = [...file.text.matchAll(CODE_SPAN)]
    .flatMap((match) => match[1].split(/\s+/))
    .map((token) => REPO_PATH.exec(token)?.[1])
    .filter(Boolean)
  const links = [...file.text.matchAll(RELATIVE_LINK)].map((match) =>
    path.posix.normalize(
      path.posix.join(path.posix.dirname(file.path), match[1])
    )
  )
  return unique([...spans, ...links])
}

export function unresolvedReferences(files, exists) {
  const rows = ruleRows(files)
  const hasReferences = files.some(isReference)
  const missingRules = files
    .filter((file) => hasReferences && file.path.endsWith("/SKILL.md"))
    .flatMap((file) =>
      citedRules(file.text)
        .filter((id) => !rows.has(id))
        .map((id) => `${file.path}: rule ${id} has no row in references/`)
    )
  const missingPaths = files.flatMap((file) =>
    namedPaths(file)
      .filter((named) => !exists(named))
      .map((named) => `${file.path}: ${named} does not exist`)
  )
  return [...missingRules, ...missingPaths]
}
