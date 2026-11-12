import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"

import { render } from "@/test/render-with-client.tsx"
import { job } from "@/test/paper-letter-kit.tsx"

import { PaperLetterStart } from "./paper-letter.tsx"

const MINTED = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Start blank Letter", () => {
  it("mints a Word page labelled letter and opens it", async () => {
    const calls: { url: string; body: unknown }[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      })
      return Promise.resolve(
        Response.json({
          ok: true,
          data: {
            generation: "package",
            docId: MINTED,
            revision: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            name: "Cover letter.docx",
            kind: "letter",
            packageHash: "ab".repeat(32),
            byteSize: 128,
            incarnation: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            restore: null,
          },
        })
      )
    })
    const onCreated = vi.fn()
    render(<PaperLetterStart jobs={[job]} onCreated={onCreated} />)
    fireEvent.click(screen.getByRole("button", { name: "Start blank" }))
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith(MINTED))
    expect(
      calls.find((call) => call.url.includes("/api/commands/paper.canvas"))
        ?.body
    ).toMatchObject({ input: { op: "mint", label: "letter" } })
    expect(
      calls.some((call) => call.url.includes("/api/commands/paper.create"))
    ).toBe(false)
  })
})
