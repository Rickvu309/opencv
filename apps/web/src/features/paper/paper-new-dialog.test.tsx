import { useReducer } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"
import { render } from "@/test/render-with-client.tsx"

import { Dialog, DialogContent } from "@workspace/ui/components/dialog"

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
    fireEvent.click(screen.getByRole("radio", { name: "Modern" }))
    fireEvent.click(screen.getByRole("button", { name: "Use Modern" }))
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
    fireEvent.click(screen.getByRole("radio", { name: "Blank" }))
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

  it("opens the file picker from Import a file without making a page", () => {
    const onImport = vi.fn()
    const onMinted = vi.fn()
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    render(<Harness onMinted={onMinted} onImport={onImport} />)
    fireEvent.click(screen.getByRole("button", { name: "CV" }))
    fireEvent.click(screen.getByRole("button", { name: "Import a file" }))
    expect(onImport).toHaveBeenCalledTimes(1)
    expect(fetch).not.toHaveBeenCalled()
    expect(onMinted).not.toHaveBeenCalled()
  })
})

function Harness({
  onMinted,
  onImport = () => undefined,
}: {
  onMinted: (docId: string) => void
  onImport?: () => void
}) {
  const [step, setStep] = useReducer(
    (_: "kind" | "gallery", next: "kind" | "gallery") => next,
    "kind"
  )
  return (
    <Dialog open>
      <DialogContent>
        <PaperNewDialog
          step={step}
          onStepChange={setStep}
          onMinted={onMinted}
          onChooseLetter={() => undefined}
          onImport={onImport}
        />
      </DialogContent>
    </Dialog>
  )
}
