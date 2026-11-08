import { randomUUID } from "node:crypto"

import {
  paperPackageReadSchema,
  paperPackageStageSchema,
} from "@workspace/domain"
import { afterAll, expect, it, vi } from "vitest"
import { z } from "zod"

import { withDatabase } from "../db/context.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"
import { fixturePackage, paragraph } from "./package-fixtures.js"
import { createPaperPackageRoutes } from "./package-http.js"
import { publishWordPackage, WORD_PACKAGE_MEDIA_TYPE } from "./package-store.js"

afterAll(() => vi.unstubAllEnvs())

it("keeps the generation disabled by default before session or upload handling", async () => {
  vi.stubEnv("PAPER_PACKAGE_ENABLED", "")
  const app = createPaperPackageRoutes()
  expect((await app.request("/stage", { method: "POST" })).status).toBe(404)
  expect((await app.request("/")).status).toBe(404)
})

it("authenticates staging, reads pinned snapshots, and exports exact DOCX bytes over HTTP", async () => {
  vi.stubEnv("PAPER_PACKAGE_ENABLED", "true")
  const { db, client } = await createMigratedTestDb()
  try {
    const app = createTestApp(db)
    expect((await app.request("/api/paper/packages/")).status).toBe(401)
    const signed = await signUp(app, {
      name: "Package owner",
      email: `${randomUUID()}@test.invalid`,
    })
    const headers = new Headers({
      ...authHeaders(signed.cookie),
      "idempotency-key": randomUUID(),
    })
    headers.set("content-type", WORD_PACKAGE_MEDIA_TYPE)
    const bytes = fixturePackage(paragraph("HTTP original words"))
    const stagedResponse = await app.request(
      "/api/paper/packages/stage?name=Letter.docx&kind=letter",
      { method: "POST", headers, body: new Uint8Array(bytes) }
    )
    expect(stagedResponse.status, await stagedResponse.clone().text()).toBe(201)
    const staged = z
      .object({ data: paperPackageStageSchema })
      .parse(await stagedResponse.json()).data
    const sessionResponse = await app.request("/api/auth/get-session", {
      headers: authHeaders(signed.cookie),
    })
    const session = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await sessionResponse.json())
    expect(
      (
        await app.request(`/api/paper/packages/${staged.docId}/read`, {
          headers,
        })
      ).status
    ).toBe(404)
    await withDatabase(db, () =>
      publishWordPackage(session.user.id, staged.stageId)
    )
    const read = await app.request(
      `/api/paper/packages/${staged.docId}/read?at=${staged.revision}`,
      { headers }
    )
    expect(read.status).toBe(200)
    expect(read.headers.get("cache-control")).toBe("private, no-store")
    const page = z
      .object({ data: paperPackageReadSchema })
      .parse(await read.json()).data
    expect(page.regions[0]?.text).toBe("HTTP original words")
    const downloaded = await app.request(
      `/api/paper/packages/${staged.docId}/export?at=${staged.revision}`,
      { headers }
    )
    expect(downloaded.status).toBe(200)
    expect(downloaded.headers.get("content-type")).toBe(WORD_PACKAGE_MEDIA_TYPE)
    expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(bytes)
    expect(
      (
        await app.request(`/api/paper/packages/${staged.docId}/export`, {
          headers,
        })
      ).status
    ).toBe(400)
    expect(
      (
        await app.request(`/api/paper/packages/${staged.docId}/publish`, {
          method: "POST",
          headers,
        })
      ).status
    ).toBe(404)
    const oversizeHeaders = new Headers(headers)
    oversizeHeaders.set("content-length", String(8 * 1024 * 1024 + 1))
    const oversize = await app.request(
      "/api/paper/packages/stage?name=big.docx&kind=cv",
      {
        method: "POST",
        headers: oversizeHeaders,
        body: new Uint8Array(bytes),
      }
    )
    expect(oversize.status).toBe(400)
  } finally {
    await client.close()
  }
})
