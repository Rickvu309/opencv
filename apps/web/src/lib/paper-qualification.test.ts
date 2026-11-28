import { QueryClient } from "@tanstack/react-query"
import { parsePaperId } from "@workspace/domain/kernel"
import {
  nativeProvenance,
  nativePaperDocumentSchema,
} from "@workspace/domain/paper-doc"
import { afterEach, expect, it, vi } from "vitest"
import { readPaperList } from "./paper-list.ts"
import { endpoints } from "./requests.ts"
import { qualifiedPaperKey, qualifiedPaperRead } from "./paper-qualification.ts"

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
function listQualified(
  qualification: Parameters<typeof qualifiedPaperRead>[2]
) {
  return qualifiedPaperRead("paper.list", endpoints.paper, qualification)
}
function listKey(qualification: Parameters<typeof qualifiedPaperKey>[1]) {
  return qualifiedPaperKey(paperListPrefix(), qualification)
}
function response(data: unknown) {
  return Response.json({ ok: true, data })
}
const paperListPrefix = () => ["paper.list"] as const
afterEach(() => vi.unstubAllGlobals())

it("keeps all default reads unqualified", async () => {
  const fetch = vi.fn().mockImplementation(async () => response([]))
  vi.stubGlobal("fetch", fetch)
  await readPaperList()
  for (const [, init] of fetch.mock.calls)
    expect(JSON.parse(init.body)).not.toHaveProperty("writer")
})

it.each([
  undefined,
  { ...basis, digest: "bad" },
  { ...basis, revision: 4 },
  { ...basis, provenance: { ...basis.provenance, schemaRevision: 2 } },
])("refuses missing or mismatched native basis %j", async (nativeBasis) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(response([{ ...view, nativeBasis }]))
  )
  await expect(listQualified(options)).rejects.toThrow()
})

it("scopes qualified keys without losing command invalidation prefixes", async () => {
  const client = new QueryClient()
  const key = listKey(options)
  expect(key.slice(0, 1)).toEqual(paperListPrefix())
  for (const other of [
    { ...options, ownerId: "other" },
    { ...options, sessionId: "new" },
  ])
    expect(listKey(other)).not.toEqual(key)
  expect(listKey({ ...options })).toEqual(key)
  client.setQueryData(key, [view])
  client.setQueryData(paperListPrefix(), { legacy: true })
  await client.invalidateQueries({ queryKey: paperListPrefix() })
  expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  expect(client.getQueryData(paperListPrefix())).toEqual({ legacy: true })
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
  const pending = listQualified({
    ...options,
    signal: controller.signal,
  })
  controller.abort()
  complete?.(response([view]))
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
      .mockResolvedValue(response([view]))
  )
  const oldKey = listKey(options)
  const pending = client
    .fetchQuery({
      queryKey: oldKey,
      queryFn: ({ signal }) => listQualified({ ...options, signal }),
    })
    .catch(() => undefined)
  await client.cancelQueries({ queryKey: oldKey })
  const next = { ...options, sessionId: "next" }
  await client.fetchQuery({
    queryKey: listKey(next),
    queryFn: () => listQualified(next),
  })
  complete?.(response([{ ...view, name: "Old session" }]))
  await pending
  expect(client.getQueryData(listKey(next))).toEqual([view])
  expect(client.getQueryData(oldKey)).toBeUndefined()
  client.clear()
})

it("no Paper list read sends the old writer", async () => {
  const fetcher = vi.fn().mockImplementation(async () => response([view]))
  vi.stubGlobal("fetch", fetcher)
  await readPaperList()
  expect(JSON.parse(fetcher.mock.calls[0]?.[1].body)).not.toHaveProperty(
    "writer"
  )
  await qualifiedPaperRead("paper.list", endpoints.paper, options)
  expect(JSON.parse(fetcher.mock.calls[1]?.[1].body)).not.toHaveProperty(
    "writer"
  )
})
