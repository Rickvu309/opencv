import { QueryClient } from "@tanstack/react-query"
import {
  NATIVE_WRITER,
  nativeProvenance,
  nativePaperDocumentSchema,
  parsePaperId,
  paperQueries,
} from "@workspace/domain"
import { afterEach, expect, it, vi } from "vitest"
import {
  listQualifiedPaper,
  getQualifiedPaper,
  getQualifiedPaperPages,
  getQualifiedSharedPaper,
  listPaper,
  getPaper,
  getPaperPages,
  getSharedPaper,
  paperGetKey,
  qualifiedPaperGetKey,
  qualifiedPaperSharedKey,
} from "../features/paper/paper-api.ts"

import {
  coachPaperOptions,
  qualifiedCoachPaperOptions,
} from "./coach-context.ts"

const id = parsePaperId("01990b00-0000-7000-8000-000000000001")
const options = { ownerId: "owner", sessionId: "session" }
const paper = nativePaperDocumentSchema.parse({
  version: 4,
  schemaRevision: 1,
  kind: "letter",
  clashes: [],
  blocks: [
    {
      id: "p1",
      type: "paragraph",
      content: [{ text: "Việt 😀", underline: true }],
    },
  ],
})
const basis = {
  provenance: nativeProvenance(paper),
  epoch: 1,
  revision: 3,
  digest: "a".repeat(64),
}
const view = {
  id,
  name: "Letter",
  kind: "letter",
  templateId: null,
  status: "draft",
  paper,
  nativeBasis: basis,
  contentVersion: 3,
  checks: [],
  pageChoice: "unset",
  isFavorite: false,
  sourceFileId: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
}
const shared = paperQueries["paper.shared"].output.parse(
  Object.fromEntries(
    Object.entries({
      ...view,
      nativeBasis: undefined,
      contentVersion: 99,
    }).filter(
      ([key, value]) =>
        value !== undefined && key in paperQueries["paper.shared"].output.shape
    )
  )
)
function response(data: unknown) {
  return Response.json({ ok: true, data })
}
afterEach(() => vi.unstubAllGlobals())

it("qualifies exactly four opt-in GET routes with credentials and the declared writer", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response([view]))
    .mockResolvedValueOnce(response(view))
    .mockResolvedValueOnce(
      response({ docId: id, pages: 1, pageChoice: "unset" })
    )
    .mockResolvedValueOnce(response(shared))
  vi.stubGlobal("fetch", fetch)
  expect(await listQualifiedPaper(options)).toEqual([view])
  expect(await getQualifiedPaper(id, options)).toEqual(view)
  await getQualifiedPaperPages(id, options)
  expect(await getQualifiedSharedPaper("share-token", options)).toEqual(shared)
  expect(fetch.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
    "/api/paper",
    `/api/paper/${id}`,
    `/api/paper/${id}/pages`,
    "/api/paper/shared/share-token",
  ])
  for (const [, init] of fetch.mock.calls) {
    expect(init.credentials).toBe("include")
    expect(JSON.parse(init.headers.get("x-paper-writer"))).toEqual(
      NATIVE_WRITER
    )
  }
})

it("admits a read-only share without owner edit authority", async () => {
  const fetch = vi.fn().mockImplementation(async () => response(shared))
  vi.stubGlobal("fetch", fetch)
  const result = await getQualifiedSharedPaper("share-token", options)
  expect(result.paper).toEqual(paper)
  expect(result).not.toHaveProperty("nativeBasis")
  expect(Object.keys(result)).toEqual(Object.keys(shared))
  await expect(
    getQualifiedSharedPaper("share-token", {
      ...options,
      writer: { ...NATIVE_WRITER, capabilities: [] },
    })
  ).rejects.toThrow()
  expect(fetch).toHaveBeenCalledTimes(2)
  for (const [, init] of fetch.mock.calls)
    expect(init.method ?? "GET").toBe("GET")
})

it("keeps all default reads unqualified", async () => {
  const fetch = vi.fn().mockImplementation(async () => response({}))
  vi.stubGlobal("fetch", fetch)
  await listPaper()
  await getPaper(id)
  await getPaperPages(id)
  await getSharedPaper("share-token")
  for (const [, init] of fetch.mock.calls)
    expect(init.headers.has("x-paper-writer")).toBe(false)
})

it.each([
  undefined,
  { ...basis, digest: "bad" },
  { ...basis, revision: 4 },
  { ...basis, provenance: { ...basis.provenance, schemaRevision: 2 } },
])("refuses missing or mismatched native basis %j", async (nativeBasis) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(response({ ...view, nativeBasis }))
  )
  await expect(getQualifiedPaper(id, options)).rejects.toThrow()
})

it("preserves an incompatible writer and propagates refusal without retry", async () => {
  const fetch = vi.fn().mockResolvedValue(
    Response.json(
      {
        ok: false,
        error: { code: "CONFLICT", message: "Unsupported writer" },
      },
      { status: 409 }
    )
  )
  vi.stubGlobal("fetch", fetch)
  const writer = { ...NATIVE_WRITER, supportedSchemaRevisions: [2] }
  await expect(
    getQualifiedPaper(id, { ...options, writer })
  ).rejects.toMatchObject({ code: "CONFLICT" })
  expect(
    JSON.parse(fetch.mock.calls[0]![1].headers.get("x-paper-writer"))
  ).toEqual(writer)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it("scopes qualified keys without losing command invalidation prefixes", async () => {
  const client = new QueryClient()
  const key = qualifiedPaperGetKey(id, options)
  expect(key.slice(0, 2)).toEqual(paperGetKey(id))
  for (const other of [
    { ...options, ownerId: "other" },
    { ...options, sessionId: "new" },
    { ...options, writer: { ...NATIVE_WRITER, capabilities: [] } },
  ])
    expect(qualifiedPaperGetKey(id, other)).not.toEqual(key)
  expect(qualifiedPaperGetKey(id, { ...options })).toEqual(key)
  expect(qualifiedPaperSharedKey("share-token", options)[0]).toBe(
    "paper.shared"
  )
  client.setQueryData(key, view)
  client.setQueryData(paperGetKey(id), { legacy: true })
  await client.invalidateQueries({ queryKey: paperGetKey(id) })
  expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  expect(client.getQueryData(paperGetKey(id))).toEqual({ legacy: true })
  client.clear()
})

it("discards cancelled late replies even when fetch ignores abort", async () => {
  let complete: ((value: Response) => void) | undefined
  const fetch = vi.fn().mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        complete = resolve
      })
  )
  vi.stubGlobal("fetch", fetch)
  const controller = new AbortController()
  const pending = getQualifiedPaper(id, {
    ...options,
    signal: controller.signal,
  })
  controller.abort()
  complete?.(response(view))
  await expect(pending).rejects.toMatchObject({ name: "AbortError" })
  expect(fetch.mock.calls[0]![1].signal).toBe(controller.signal)
})

it("cancellation cannot populate the next session cache", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  let complete: ((value: Response) => void) | undefined
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            complete = resolve
          })
      )
      .mockResolvedValue(response(view))
  )
  const oldKey = qualifiedPaperGetKey(id, options)
  const pending = client
    .fetchQuery({
      queryKey: oldKey,
      queryFn: ({ signal }) => getQualifiedPaper(id, { ...options, signal }),
    })
    .catch(() => undefined)
  await client.cancelQueries({ queryKey: oldKey })
  const next = { ...options, sessionId: "next" }
  await client.fetchQuery({
    queryKey: qualifiedPaperGetKey(id, next),
    queryFn: () => getQualifiedPaper(id, next),
  })
  complete?.(response({ ...view, name: "Old session" }))
  await pending
  expect(client.getQueryData(qualifiedPaperGetKey(id, next))).toEqual(view)
  expect(client.getQueryData(oldKey)).toBeUndefined()
  client.clear()
})

it("keeps the default Coach query separate from explicit qualified context", async () => {
  const fetcher = vi.fn().mockImplementation(async () => response([view]))
  vi.stubGlobal("fetch", fetcher)
  await coachPaperOptions()
  expect(
    new Headers(fetcher.mock.calls[0]?.[1].headers).has("x-paper-writer")
  ).toBe(false)
  await qualifiedCoachPaperOptions(options)
  expect(
    new Headers(fetcher.mock.calls[1]?.[1].headers).get("x-paper-writer")
  ).toBe(JSON.stringify(NATIVE_WRITER))
})
