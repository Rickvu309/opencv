import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { PaperNewDialog } from "./paper-new-dialog.tsx"

function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Paper new dialog", () => {
  it("posts paper.create for Simple", async () => {
    const calls: { url: string; body: unknown }[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({
        url,
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      })
      return Promise.resolve(
        ok({
          id: "cv-1",
          name: "CV",
          kind: "cv",
          templateId: "simple",
          document: {},
          contentVersion: 1,
          createdAt: "2026-08-25T12:00:00.000Z",
          updatedAt: "2026-08-25T12:00:00.000Z",
        })
      )
    })

    render(
      <PaperNewDialog
        onCreated={() => undefined}
        onChooseLetter={() => undefined}
        onImport={() => undefined}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "CV" }))
    fireEvent.click(screen.getByRole("button", { name: "Simple" }))
    fireEvent.click(screen.getByRole("button", { name: "Use template" }))

    await vi.waitFor(() => {
      expect(
        calls.some((call) => call.url.includes("/api/commands/paper.create"))
      ).toBe(true)
    })
    expect(
      calls.find((call) => call.url.includes("/api/commands/paper.create"))
        ?.body
    ).toEqual({ kind: "cv", templateId: "simple" })
  })
})
