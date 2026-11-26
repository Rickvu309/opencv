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
  it("creates a Paper from the chosen template and opens it", async () => {
    const created = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    const calls: { url: string; body: unknown }[] = []
    const onMinted = vi.fn()
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      })
      return Promise.resolve(
        ok({ id: created, name: "Modern CV", kind: "cv", format: "rich" })
      )
    })
    render(<Harness onMinted={onMinted} />)
    fireEvent.click(screen.getByRole("button", { name: "CV" }))
    fireEvent.click(screen.getByRole("radio", { name: "Modern" }))
    fireEvent.click(screen.getByRole("button", { name: "Use Modern" }))
    await vi.waitFor(() => expect(onMinted).toHaveBeenCalledWith(created))
    expect(
      calls.find((call) => call.url.includes("/api/commands/paper.create"))
        ?.body
    ).toMatchObject({
      input: { kind: "cv", format: "rich", templateId: "modern" },
    })
  })

  it("creates a blank rich CV and opens that document", async () => {
    const created = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const calls: { url: string; body: unknown }[] = []
    const onMinted = vi.fn()
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      })
      return Promise.resolve(
        ok({
          id: created,
          name: "Untitled CV",
          kind: "cv",
          format: "rich",
          provenance: {
            documentVersion: 4,
            schemaRevision: 2,
            writerProtocol: 1,
            profile: "private-layout-3",
            requiredCapabilities: [],
          },
          updatedAt: new Date().toISOString(),
        })
      )
    })
    render(<Harness onMinted={onMinted} />)
    fireEvent.click(screen.getByRole("button", { name: "CV" }))
    fireEvent.click(screen.getByRole("radio", { name: "Blank" }))
    fireEvent.click(screen.getByRole("button", { name: "Start blank" }))
    await vi.waitFor(() => expect(onMinted).toHaveBeenCalledWith(created))
    expect(
      calls.find((call) => call.url.includes("/api/commands/paper.create"))
        ?.body
    ).toMatchObject({ input: { kind: "cv", format: "rich" } })
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
