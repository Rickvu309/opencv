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

  it("mints a blank page and opens that document", async () => {
    const minted = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const calls: string[] = []
    const onMinted = vi.fn()
    const onCreated = vi.fn()
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      return Promise.resolve(
        ok({
          generation: "package",
          docId: minted,
          revision: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          name: "Page.docx",
          kind: "letter",
          packageHash: "ab".repeat(32),
          byteSize: 128,
          incarnation: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          restore: null,
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
          onCreated={onCreated}
          onMinted={onMinted}
          onChooseLetter={() => undefined}
          onImport={() => undefined}
        />
      )
    }
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "CV" }))
    fireEvent.click(screen.getByRole("button", { name: "Start blank" }))
    await vi.waitFor(() => expect(onMinted).toHaveBeenCalledWith(minted))
    expect(onCreated).not.toHaveBeenCalled()
    expect(
      calls.some((url) => url.includes("/api/commands/paper.canvas"))
    ).toBe(true)
    expect(
      calls.some((url) => url.includes("/api/commands/paper.create"))
    ).toBe(false)
  })

  it("keeps today's blank CV when saved documents are unavailable", async () => {
    const calls: string[] = []
    const onCreated = vi.fn()
    const onMinted = vi.fn()
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (url.includes("/api/commands/paper.canvas")) {
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
      }
      return Promise.resolve(
        ok({
          id: "cv-1",
          name: "CV",
          kind: "cv",
          templateId: null,
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
          onCreated={onCreated}
          onMinted={onMinted}
          onChooseLetter={() => undefined}
          onImport={() => undefined}
        />
      )
    }
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "CV" }))
    fireEvent.click(screen.getByRole("button", { name: "Start blank" }))
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(onMinted).not.toHaveBeenCalled()
    expect(
      calls.some((url) => url.includes("/api/commands/paper.create"))
    ).toBe(true)
  })
})
