import { QueryClient } from "@tanstack/react-query"
import { NATIVE_WRITER, parsePaperId } from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"

import { qualifiedPaperKey } from "./paper-qualification.ts"
import { runContractCommand } from "./contract-client.ts"

afterEach(() => vi.unstubAllGlobals())

describe("native Paper metadata requests", () => {
  it.each(["paper.duplicate"] as const)(
    "qualifies outgoing %s without changing its input",
    async (name) => {
      const input = {
        docId: parsePaperId("01990b00-0000-7000-8000-000000000001"),
      }
      const before = structuredClone(input)
      const fetch = vi
        .fn()
        .mockImplementation(async () => Response.json({ ok: true, data: {} }))
      vi.stubGlobal("fetch", fetch)
      await runContractCommand(new QueryClient(), name, input, {
        refresh: false,
      })
      expect(String(fetch.mock.calls[0]?.[0])).toContain(
        `/api/commands/${name}`
      )
      expect(JSON.parse(fetch.mock.calls[0]?.[1].body).input).toEqual({
        ...input,
        writer: NATIVE_WRITER,
      })
      expect(input).toEqual(before)
      expect(input).not.toHaveProperty("writer")
    }
  )

  it("preserves an explicitly incompatible outgoing writer for server refusal", async () => {
    const input = {
      docId: parsePaperId("01990b00-0000-7000-8000-000000000001"),
      writer: { ...NATIVE_WRITER, supportedSchemaRevisions: [2] },
    }
    const before = structuredClone(input)
    const fetch = vi
      .fn()
      .mockImplementation(async () => Response.json({ ok: true, data: {} }))
    vi.stubGlobal("fetch", fetch)
    await runContractCommand(new QueryClient(), "paper.duplicate", input, {
      refresh: false,
    })
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body).input).toEqual(input)
    expect(input).toEqual(before)
  })

  it("leaves creation, edit and sync requests unqualified", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => Response.json({ ok: true, data: {} }))
    vi.stubGlobal("fetch", fetch)
    const client = new QueryClient()
    const docId = parsePaperId("01990b00-0000-7000-8000-000000000001")
    const inputs = [
      { name: "paper.create", input: { kind: "letter" } },
      { name: "paper.edit", input: { docId } },
      { name: "paper.nativeSync", input: { docId } },
    ]
    for (const { name, input } of inputs) {
      const before = structuredClone(input)
      await Reflect.apply(runContractCommand, undefined, [
        client,
        name,
        input,
        { refresh: false },
      ])
      expect(JSON.parse(fetch.mock.calls.at(-1)?.[1].body).input).toEqual(input)
      expect(input).toEqual(before)
      expect(input).not.toHaveProperty("writer")
    }
  })
})

it("retries a qualified edit with its exact intent key and input, then invalidates its qualified cache", async () => {
  const docId = parsePaperId("01990b00-0000-7000-8000-000000000001")
  const input = {
    docId,
    basedOn: 3,
    writer: NATIVE_WRITER,
    nativeBasis: {
      provenance: {
        documentVersion: 4 as const,
        schemaRevision: 1 as const,
        writerProtocol: 1 as const,
        requiredCapabilities: ["structured-prose", "underline"] as (
          "structured-prose" | "underline"
        )[],
      },
      epoch: 1,
      revision: 3,
      digest: "a".repeat(64),
    },
    edits: [{ op: "setText" as const, blockId: "p1", text: "Words" }],
  }
  const original = structuredClone(input)
  const fetch = vi
    .fn()
    .mockImplementation(async () => Response.json({ ok: true, data: {} }))
  vi.stubGlobal("fetch", fetch)
  const client = new QueryClient()
  const key = qualifiedPaperKey(["paper.outline", { docId }], {
    ownerId: "owner",
    sessionId: "session",
  })
  client.setQueryData(key, { old: true })
  for (const attempt of [1, 2]) {
    void attempt
    await runContractCommand(client, "paper.edit", input, {
      idempotencyKey: "same-native-intent",
    })
  }
  const requests = fetch.mock.calls.map(([, init]) => JSON.parse(init.body))
  expect(requests).toEqual([
    { input: original, idempotencyKey: "same-native-intent" },
    { input: original, idempotencyKey: "same-native-intent" },
  ])
  expect(input).toEqual(original)
  expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  client.clear()
})
