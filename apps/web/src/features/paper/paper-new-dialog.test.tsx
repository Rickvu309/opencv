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
  it("mints a Word page from the chosen template and opens it", async () => {
    const minted = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    const calls: { url: string; body: unknown }[] = []
    const onMinted = vi.fn()
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
          name: "Modern CV.docx",
          kind: "cv",
          packageHash: "ab".repeat(32),
          byteSize: 128,
          incarnation: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          restore: null,
        })
      )
    })
    render(<Harness onMinted={onMinted} />)
    fireEvent.click(screen.getByRole("button", { name: "CV" }))
    fireEvent.click(screen.getByRole("button", { name: "Modern" }))
    fireEvent.click(screen.getByRole("button", { name: "Use template" }))
    await vi.waitFor(() => expect(onMinted).toHaveBeenCalledWith(minted))
    expect(
      calls.find((call) => call.url.includes("/api/commands/paper.canvas"))
        ?.body
    ).toMatchObject({
      input: { op: "mint", label: "cv", templateId: "modern" },
    })
    expect(
      calls.some((call) => call.url.includes("/api/commands/paper.create"))
    ).toBe(false)
  })

  it("mints a blank CV page and opens that document", async () => {
    const minted = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const calls: { url: string; body: unknown }[] = []
    const onMinted = vi.fn()
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
    render(<Harness onMinted={onMinted} />)
    fireEvent.click(screen.getByRole("button", { name: "CV" }))
    fireEvent.click(screen.getByRole("button", { name: "Start blank" }))
    await vi.waitFor(() => expect(onMinted).toHaveBeenCalledWith(minted))
    expect(
      calls.find((call) => call.url.includes("/api/commands/paper.canvas"))
        ?.body
    ).toMatchObject({ input: { op: "mint", label: "cv" } })
    expect(
      calls.some((call) => call.url.includes("/api/commands/paper.create"))
    ).toBe(false)
  })
})

function Harness({ onMinted }: { onMinted: (docId: string) => void }) {
  const [step, setStep] = useReducer(
    (_: "kind" | "gallery", next: "kind" | "gallery") => next,
    "kind"
  )
  return (
    <PaperNewDialog
      step={step}
      onStepChange={setStep}
      onMinted={onMinted}
      onChooseLetter={() => undefined}
      onImport={() => undefined}
    />
  )
}
