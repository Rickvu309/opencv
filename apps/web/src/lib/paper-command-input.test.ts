import { QueryClient } from "@tanstack/react-query"
import { NATIVE_WRITER, parsePaperId } from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"

import { runContractCommand } from "./contract-client.ts"

afterEach(() => vi.unstubAllGlobals())

describe("native Paper metadata requests", () => {
  it.each(["paper.rename", "paper.duplicate", "paper.setStatus"] as const)(
    "qualifies outgoing %s without changing its input",
    async (name) => {
      const input = {
        docId: parsePaperId("01990b00-0000-7000-8000-000000000001"),
        name: "Letter",
        status: "draft" as const,
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
      name: "Letter",
      writer: { ...NATIVE_WRITER, supportedSchemaRevisions: [2] },
    }
    const before = structuredClone(input)
    const fetch = vi
      .fn()
      .mockImplementation(async () => Response.json({ ok: true, data: {} }))
    vi.stubGlobal("fetch", fetch)
    await runContractCommand(new QueryClient(), "paper.rename", input, {
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
      { name: "paper.sync", input: { docId } },
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
