import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api-error.ts"
import { apiBaseUrl } from "@/lib/api-url.ts"

import { runCommand } from "./api-envelope.ts"

afterEach(() => vi.unstubAllGlobals())

describe("runCommand", () => {
  it("posts JSON to the command path and returns the data field", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ ok: true, data: { id: "d1" } }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(runCommand("paper.createDoc", { a: 1 })).resolves.toEqual({
      id: "d1",
    })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe(`${apiBaseUrl}/api/commands/paper.createDoc`)
    expect(init).toMatchObject({ method: "POST", body: '{"a":1}' })
  })

  it("rejects with ApiError on an error envelope", async () => {
    const error = { code: "VALIDATION_FAILED", message: "Bad input" }
    const res = Response.json({ ok: false, error }, { status: 422 })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res))

    const failure = await runCommand("paper.createDoc", {}).catch((e) => e)
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({ status: 422, ...error })
  })
})
