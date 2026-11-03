import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..")
const SCHEMA = path.join(root, "apps/api/src/db/schema.ts")

const COLUMN_BUILDER =
  /\b(?:boolean|bytea|date|integer|jsonb|text|timestamptz|uuid)\(\s*"([A-Za-z_][A-Za-z0-9_]*)"/g

const CREATE_TABLE =
  /CREATE TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:"[^"]+"\s*\.\s*)?"[^"]+"\s*\(([\s\S]*?)\)\s*;/gi

const FUNCTION =
  /CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+(?:"[^"]+"\s*\.\s*)?"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\(([^)]*)\)[\s\S]*?AS\s+\$([A-Za-z0-9_]*)\$([\s\S]*?)\$\3\$\s*LANGUAGE\s+plpgsql\b/gi

const MODES = new Set(["in", "out", "inout", "variadic"])

const identifier = (token) => {
  const quoted = /^"([^"]+)"$/.exec(token)
  return quoted ? quoted[1] : token
}

export function schemaColumnNames(source) {
  const names = new Set()
  for (const match of String(source).matchAll(COLUMN_BUILDER))
    names.add(match[1].toLowerCase())
  return names
}

export function sqlTableColumns(sql) {
  const names = new Set()
  for (const table of String(sql).matchAll(CREATE_TABLE)) {
    for (const part of table[1].split(",")) {
      const column = /^\s*"([A-Za-z_][A-Za-z0-9_]*)"\s+[A-Za-z]/.exec(part)
      if (column) names.add(column[1].toLowerCase())
    }
  }
  return names
}

function parameterNames(args) {
  return args
    .split(",")
    .map((arg) => arg.trim())
    .filter(Boolean)
    .flatMap((arg) => {
      const parts = arg.split(/\s+/)
      let index = 0
      while (index < parts.length && MODES.has(parts[index].toLowerCase()))
        index += 1
      const name = identifier(parts[index] ?? "")
      return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? [name] : []
    })
}

function declaredNames(body) {
  const block = /\bDECLARE\b([\s\S]*?)\bBEGIN\b/i.exec(body)
  if (!block) return []
  return block[1]
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .flatMap((statement) => {
      const name = /^(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/.exec(statement)
      const found = name ? (name[1] ?? name[2]) : ""
      return found ? [found] : []
    })
}

export function plpgsqlClashes(sql, columns) {
  const hits = []
  for (const match of String(sql).matchAll(FUNCTION)) {
    const seen = new Set()
    for (const name of [
      ...parameterNames(match[2]),
      ...declaredNames(match[4]),
    ]) {
      const key = name.toLowerCase()
      if (!columns.has(key) || seen.has(key)) continue
      seen.add(key)
      hits.push(`${match[1]} ${name}`)
    }
  }
  return hits
}

export function detect(sql) {
  const columns = schemaColumnNames(readFileSync(SCHEMA, "utf8"))
  for (const name of sqlTableColumns(sql)) columns.add(name)
  return plpgsqlClashes(sql, columns)
}
