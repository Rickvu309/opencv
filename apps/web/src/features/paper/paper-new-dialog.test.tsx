import { useReducer } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"
import { render } from "@/test/render-with-client.tsx"

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
        body:
          typeof init?.body === "string"
            ? (JSON.parse(init.body) as { input?: unknown }).input
            : null,
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

    function Harness() {
      const [step, setStep] = useReducer(
        (_: "kind" | "gallery", next: "kind" | "gallery") => next,
        "kind"
      )
      return (
        <PaperNewDialog
          step={step}
          onStepChange={setStep}
          onCreated={() => undefined}
          onMinted={() => undefined}
          onChooseLetter={() => undefined}
          onImport={() => undefined}
        />
      )
    }

    render(<Harness />)
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
    ).toMatchObject({
      kind: "cv",
      templateId: "simple",
    })
  })

  it("mints a blank CV page and opens that document", async () => {
    const minted = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const calls: { url: string; body: unknown }[] = []
    const onMinted = vi.fn()
    const onCreated = vi.fn()
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      })
      return Promise.resolve(
        ok({
          generation: "package",
          docId: minted,
          revision: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          name: "CV.docx",
          kind: "cv",
          packageHash: "ab".repeat(32),
          byteSize: 128,
          incarnation: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          restore: null,
        })
      )
    })
    render(<Harness onCreated={onCreated} onMinted={onMinted} />)
    fireEvent.click(screen.getByRole("button", { name: "CV" }))
    fireEvent.click(screen.getByRole("button", { name: "Start blank" }))
    await vi.waitFor(() => expect(onMinted).toHaveBeenCalledWith(minted))
    expect(onCreated).not.toHaveBeenCalled()
    expect(
      calls.find((call) => call.url.includes("/api/commands/paper.canvas"))
        ?.body
    ).toMatchObject({ input: { op: "mint", label: "cv" } })
    expect(
      calls.some((call) => call.url.includes("/api/commands/paper.create"))
    ).toBe(false)
  })

  it("says so and creates no older document when Word pages are off", async () => {
    const calls: string[] = []
    const onCreated = vi.fn()
    const onMinted = vi.fn()
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      calls.push(String(input))
      return Promise.resolve(
        Response.json(
          {
            ok: false,
            error: {
              code: "NOT_FOUND",
              message: "Saved Word documents are unavailable.",
            },
          },
          { status: 404 }
        )
      )
    })
    render(<Harness onCreated={onCreated} onMinted={onMinted} />)
    fireEvent.click(screen.getByRole("button", { name: "CV" }))
    fireEvent.click(screen.getByRole("button", { name: "Start blank" }))
    expect(
      await screen.findByText("Saved Word documents are unavailable.")
    ).toBeTruthy()
    expect(onMinted).not.toHaveBeenCalled()
    expect(onCreated).not.toHaveBeenCalled()
    expect(
      calls.some((url) => url.includes("/api/commands/paper.create"))
    ).toBe(false)
  })
})

function Harness({
  onCreated,
  onMinted,
}: {
  onCreated: () => void
  onMinted: (docId: string) => void
}) {
  const [step, setStep] = useReducer(
    (_: "kind" | "gallery", next: "kind" | "gallery") => next,
    "kind"
  )
  return (
    <PaperNewDialog
      step={step}
      onStepChange={setStep}
      onCreated={onCreated}
      onMinted={onMinted}
      onChooseLetter={() => undefined}
      onImport={() => undefined}
    />
  )
}
