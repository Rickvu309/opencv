import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import {
  NOT_PHOTO_JSON,
  PHOTO_BYTE_SOURCES,
  PHOTO_DOCUMENT_COLUMNS,
  RELEASED_PHOTO_SOURCE,
} from "./photo-references.js"

const here = path.dirname(fileURLToPath(import.meta.url))
const schemaText = readFileSync(path.join(here, "../db/schema.ts"), "utf8")
const migrationName = readdirSync(path.join(here, "../../drizzle")).find(
  (name) => name.endsWith("_photo_refs.sql")
)
if (!migrationName) throw new Error("photo reference migration is missing")
const migrationText = readFileSync(
  path.join(here, "../../drizzle", migrationName),
  "utf8"
)
const sweepText = readFileSync(path.join(here, "photo-sweep.ts"), "utf8")

function jsonbColumns(text: string) {
  const found: { table: string; column: string }[] = []
  let table = ""
  let pending = false
  for (const line of text.split("\n")) {
    if (line.includes("opencvApp.table(")) pending = true
    if (pending) {
      const name = /"([^"]+)"/.exec(line)
      if (name) {
        table = name[1]!
        pending = false
      }
    }
    const column = /jsonb\("([^"]+)"\)/.exec(line)
    if (column) found.push({ table, column: column[1]! })
  }
  return found
}

const key = (table: string, column: string) => `${table}.${column}`

describe("photo reference schema guard", () => {
  it("names every jsonb column as a document source or a reason it cannot hold one", () => {
    const parsed = jsonbColumns(schemaText)
    const classified = new Map<string, string>()
    for (const column of PHOTO_DOCUMENT_COLUMNS) {
      classified.set(key(column.table, column.column), column.source)
    }
    for (const column of NOT_PHOTO_JSON) {
      classified.set(key(column.table, column.column), column.why)
      expect(column.why.length).toBeGreaterThan(0)
    }
    expect(parsed.length).toBeGreaterThan(0)
    expect(
      parsed.map((column) => key(column.table, column.column)).sort()
    ).toEqual([...classified.keys()].sort())
    for (const column of parsed) {
      expect(column.table).not.toBe("")
    }
  })

  it("the reference trigger reads every document column and the byte sources", () => {
    for (const column of PHOTO_DOCUMENT_COLUMNS) {
      expect(migrationText).toContain(column.source)
    }
    for (const column of PHOTO_BYTE_SOURCES) {
      expect(migrationText).toContain(column.source)
    }
    expect(sweepText).toContain("not exists")
    expect(sweepText).toContain("photo_refs")
    expect(migrationText).not.toContain("delete from opencv_app.files")
  })

  it("records a dropped photo on the update row instead of a second photo_refs migration", () => {
    const name = readdirSync(path.join(here, "../../drizzle")).find((entry) =>
      entry.includes("released_photo")
    )
    expect(name).toBe("0010_paper_released_photos.sql")
    const text = readFileSync(path.join(here, "../../drizzle", name!), "utf8")
    expect(text).toContain("released_photo_refs")
    expect(text).toContain(RELEASED_PHOTO_SOURCE)
    expect(text).toContain("AFTER DELETE")
    expect(name!.endsWith("_photo_refs.sql")).toBe(false)
  })
})
