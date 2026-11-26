import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"
import { and, eq } from "drizzle-orm"
import { expect } from "vitest"
import { z } from "zod"

import { withDatabase } from "../db/context.js"
import {
  paperDocs,
  paperPackageHeads,
  paperPackageVersions,
} from "../db/schema.js"
import { authHeaders, createMigratedTestDb, createTestApp } from "./harness.js"

export function richEditorHeaders(cookie: string) {
  return {
    ...authHeaders(cookie),
    "x-paper-writer": JSON.stringify(RICH_NATIVE_WRITER),
  }
}

type Db = Awaited<ReturnType<typeof createMigratedTestDb>>["db"]

const listed = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        kind: z.string(),
        format: z.string().optional(),
      })
      .passthrough()
  ),
})

export async function livePagesOf(db: Db, userId: string) {
  return withDatabase(db, async () => {
    const heads = await db
      .select({ id: paperPackageHeads.docId, kind: paperPackageVersions.kind })
      .from(paperPackageHeads)
      .innerJoin(
        paperPackageVersions,
        and(
          eq(paperPackageHeads.docId, paperPackageVersions.docId),
          eq(paperPackageHeads.revision, paperPackageVersions.revision)
        )
      )
      .where(eq(paperPackageHeads.userId, userId))
    const docs = await db
      .select({ id: paperDocs.id, kind: paperDocs.kind })
      .from(paperDocs)
      .where(eq(paperDocs.userId, userId))
    return [
      ...heads.map((row) => ({ id: row.id, kind: row.kind, word: true })),
      ...docs.map((row) => ({ id: row.id, kind: row.kind, word: false })),
    ].sort((left, right) => left.id.localeCompare(right.id))
  })
}

export async function expectListIsLivePages(
  app: ReturnType<typeof createTestApp>,
  db: Db,
  account: { cookie: string }
) {
  const session = await app.request("/api/auth/get-session", {
    headers: authHeaders(account.cookie),
  })
  const userId = z
    .object({ user: z.object({ id: z.string() }) })
    .parse(await session.json()).user.id
  const response = await app.request("/api/reads/paper.list", {
    method: "POST",
    headers: authHeaders(account.cookie),
    body: JSON.stringify({ writer: RICH_NATIVE_WRITER }),
  })
  expect(response.status).toBe(200)
  const fromList = listed
    .parse(await response.json())
    .data.map((item) => ({
      id: item.id,
      kind: item.kind,
      word: item.format === "word",
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
  expect(
    fromList,
    "The document list must show exactly the account's live pages, each with its kind and format"
  ).toEqual(await livePagesOf(db, userId))
}
