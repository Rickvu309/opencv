import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import {
  PAGE_STORE_FILES,
  detect,
  pageInsertingExports,
} from "./page-writes.js"

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function apiFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return apiFiles(full)
    return full.endsWith(".ts") ? [full] : []
  })
}

const at = (relative: string, text: string) =>
  detect(text, `apps/api/src/${relative}`)

const MISTAKES: Record<string, string> = {
  "a direct insert": `import { paperDocs } from "../db/schema.js"
export async function quick(db: any) {
  await db.insert(paperDocs).values({})
}`,
  "an insert through schema.paperDocs": `import * as schema from "../db/schema.js"
export async function quick(db: any) {
  await db.insert(schema.paperDocs).values({})
}`,
  "an insert through an aliased import": `import { paperDocs as heads } from "../db/schema.js"
export async function quick(db: any) {
  await db.insert(heads).values({})
}`,
  "raw SQL": `import { sql } from "drizzle-orm"
export async function quick(db: any, id: string) {
  await db.execute(sql\`insert into opencv_app.paper_docs (id) values (\${id})\`)
}`,
  "a table kept in an object and inserted later": `import { paperDocs } from "../db/schema.js"
const targets = { page: paperDocs }
export async function quick(db: any) {
  await db.insert(targets.page).values({})
}`,
  "a table taken out of the schema by destructuring": `import * as schema from "../db/schema.js"
const { paperDocs: heads } = schema
export async function quick(db: any) {
  await db.insert(heads).values({})
}`,
  "a table reached by a computed name": `import * as schema from "../db/schema.js"
export async function quick(db: any) {
  await db.insert(schema["paperDocs"]).values({})
}`,
}

const CLEAN = `import { sql, eq } from "drizzle-orm"
import * as schema from "../db/schema.js"
import { paperDocs, paperShares } from "../db/schema.js"
type Row = typeof paperDocs.$inferSelect
export async function reads(db: any, owner: string): Promise<Row[]> {
  await db.update(paperDocs).set({ name: "x" }).where(eq(paperDocs.userId, owner))
  await db.delete(paperDocs).where(eq(paperDocs.userId, owner))
  await db.execute(sql\`select id from opencv_app.paper_docs where user_id = \${owner}\`)
  await db.select().from(schema.paperDocs)
  return db.select().from(paperDocs).innerJoin(paperShares, eq(paperDocs.id, paperShares.docId))
}`

describe("only the paper store files insert page rows", () => {
  it("finds no page-table write outside the store files in the API source", () => {
    const found = apiFiles(srcRoot).flatMap((file) =>
      detect(
        readFileSync(file, "utf8"),
        `apps/api/src/${path.relative(srcRoot, file).split(path.sep).join("/")}`
      )
    )
    expect(
      found,
      "Insert a page only through an exported function of paper/store.ts, and add its case to page-creators.test.ts"
    ).toEqual([])
  })

  it.each(Object.entries(MISTAKES))("fires on %s", (_name, text) => {
    expect(at("job/new-door.ts", text)).not.toEqual([])
  })

  it("stays quiet on reads, updates, deletes and SELECT SQL, and inside the store files", () => {
    expect(at("job/reads.ts", CLEAN)).toEqual([])
    for (const store of PAGE_STORE_FILES)
      expect(at(store, MISTAKES["a direct insert"] ?? "")).toEqual([])
  })

  it("lists an exported store function that inserts a page, even through a helper in the same file", () => {
    expect(
      pageInsertingExports([
        {
          path: "paper/store.ts",
          text: `import { paperDocs } from "../db/schema.js"
async function write(db: any) { await db.insert(paperDocs).values({}) }
export async function createQuietly(db: any) { await write(db) }
export const viaArrow = async (db: any) => db.insert(paperDocs).values({})
export async function readOnly(db: any) { return db.select().from(paperDocs) }`,
        },
      ])
    ).toEqual(["paper/store.ts#createQuietly", "paper/store.ts#viaArrow"])
  })
})
