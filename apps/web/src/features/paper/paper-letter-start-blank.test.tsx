import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"

import { render } from "@/test/render-with-client.tsx"
import { job } from "@/test/paper-letter-kit.tsx"

import { PaperLetterStart } from "./paper-letter.tsx"

const CREATED = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Start blank Letter", () => {
  it("creates a blank rich letter and opens it", async () => {
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
            id: CREATED,
            name: "Untitled Letter",
            kind: "letter",
            format: "rich",
            provenance: {
              documentVersion: 4,
              schemaRevision: 2,
              writerProtocol: 1,
              profile: "private-layout-3",
              requiredCapabilities: [],
            },
            updatedAt: new Date().toISOString(),
          },
        })
      )
    })
    const onCreated = vi.fn()
    render(<PaperLetterStart jobs={[job]} onCreated={onCreated} />)
    fireEvent.click(screen.getByRole("button", { name: "Start blank" }))
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith(CREATED))
    expect(
      calls.find((call) => call.url.includes("/api/commands/paper.create"))
        ?.body
    ).toMatchObject({ input: { kind: "letter", format: "rich" } })
    expect(
      calls.some((call) => call.url.includes("/api/commands/paper.canvas"))
    ).toBe(false)
  })
})
