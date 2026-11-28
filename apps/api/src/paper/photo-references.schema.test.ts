import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import * as schema from "../db/schema.js"
import {
  jsonbColumnKeys,
  unclassifiedJsonbColumns,
} from "../test/jsonb-columns.js"
import { createSecondSchemaTables } from "../test/second-schema.fixture.js"
import {
  NOT_PHOTO_JSON,
  PHOTO_BYTE_SOURCES,
  PHOTO_DOCUMENT_COLUMNS,
} from "./photo-references.js"

const here = path.dirname(fileURLToPath(import.meta.url))
const migrationName = readdirSync(path.join(here, "../../drizzle")).find(
  (name) => name.endsWith("_photo_refs.sql")
)
if (!migrationName) throw new Error("photo reference migration is missing")
const migrationText = readFileSync(
  path.join(here, "../../drizzle", migrationName),
  "utf8"
)
const triggerText = readdirSync(path.join(here, "../../drizzle"))
  .filter((name) => name.endsWith(".sql"))
  .map((name) => readFileSync(path.join(here, "../../drizzle", name), "utf8"))
  .filter((text) => text.includes('"replace_photo_refs"('))
  .join("\n")
const sweepText = readFileSync(path.join(here, "photo-sweep.ts"), "utf8")

const key = (table: string, column: string) => `${table}.${column}`

describe("photo reference schema guard", () => {
  it("names every jsonb column as a document source or a reason it cannot hold one", () => {
    const classified = new Map<string, string>()
    for (const column of PHOTO_DOCUMENT_COLUMNS) {
      classified.set(key(column.table, column.column), column.source)
    }
    for (const column of NOT_PHOTO_JSON) {
      classified.set(key(column.table, column.column), column.why)
      expect(column.why.length).toBeGreaterThan(0)
    }
    const parsed = jsonbColumnKeys(schema)
    expect(parsed).toContain("jobs.posting")
    expect(parsed).toContain("paper_changes.steps")
    expect(parsed).toEqual([...classified.keys()].sort())
  })

  it("fails on a jsonb column a second schema file adds that the list omits", () => {
    const classified = [
      ...PHOTO_DOCUMENT_COLUMNS.map((column) =>
        key(column.table, column.column)
      ),
      ...NOT_PHOTO_JSON.map((column) => key(column.table, column.column)),
    ]
    expect(unclassifiedJsonbColumns(schema, classified)).toEqual([])
    const withSecondFile = {
      ...schema,
      ...createSecondSchemaTables(schema.opencvApp),
    }
    expect(unclassifiedJsonbColumns(withSecondFile, classified)).toEqual([
      "resume_drafts.body",
    ])
  })

  it("the reference trigger reads every document column and the byte sources", () => {
    for (const column of PHOTO_DOCUMENT_COLUMNS) {
      expect(triggerText).toContain(`'${column.source}:' || `)
    }
    for (const column of PHOTO_BYTE_SOURCES) {
      expect(migrationText).toContain(column.source)
    }
    expect(sweepText).toContain("not exists")
    expect(sweepText).toContain("photo_refs")
    expect(migrationText).not.toContain("delete from opencv_app.files")
  })
})
