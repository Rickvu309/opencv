import { afterEach, beforeAll, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { blankCv } from "@workspace/domain"
import type { PaperClient } from "@workspace/paper-crdt"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"

import { render } from "@/test/render-with-client.tsx"
import { PaperSharePage } from "./paper-share-page.tsx"
import { letter, renderLibrary } from "./paper-library.fixtures.tsx"
import { PaperCvEditor } from "./paper-cv-editor.tsx"
import {
  render as renderEditor,
  record,
  pages,
} from "./paper-editor.fixtures.tsx"
import { seededCvClient } from "@/test/paper-fixture.ts"
import { installEditorPolyfills } from "@/test/paper-engine-kit.tsx"

const fixture = vi.hoisted(() => ({ client: null as PaperClient | null }))
vi.mock("@/lib/paper-sync.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paper-sync.ts")>()),
  usePaperSync: () => ({
    sync: null,
    status: "saved",
    generation: 1,
    client: fixture.client,
  }),
}))
beforeAll(installEditorPolyfills)

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useRouterState: (options: {
    select: (state: { location: { pathname: string } }) => unknown
  }) => options.select({ location: { pathname: "/share/tok" } }),
}))

const previousFonts = Object.getOwnPropertyDescriptor(document, "fonts")

afterEach(() => {
  cleanup()
  if (previousFonts) Object.defineProperty(document, "fonts", previousFonts)
  else Reflect.deleteProperty(document, "fonts")
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function pendingPrint() {
  let release: () => void = () => undefined
  const ready = new Promise<FontFace[]>((resolve) => {
    release = () => resolve([])
  })
  const load = vi.fn(() => ready)
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { load, check: () => true },
  })
  const print = vi.spyOn(window, "print").mockImplementation(() => {
    window.dispatchEvent(new Event("afterprint"))
  })
  const error = vi.spyOn(toast, "error").mockReturnValue("print-error")
  return { release, load, print, error }
}

it("share prints once after two Download PDF requests during readiness", async () => {
  const doc = letter("Pending CV")
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ ok: true, data: doc }))
  )
  const pending = pendingPrint()
  render(<PaperSharePage />)
  const button = await screen.findByRole("button", { name: "Download PDF" })
  fireEvent.click(button)
  expect(pending.load).toHaveBeenCalled()
  fireEvent.click(button)
  expect(pending.print).not.toHaveBeenCalled()
  await act(async () => pending.release())
  expect(pending.print).toHaveBeenCalledTimes(1)
  expect(pending.error).not.toHaveBeenCalled()
  expect(document.body).not.toHaveAttribute("data-print")
})

it("library prints once after two Download PDF requests during readiness", async () => {
  const pending = pendingPrint()
  const user = userEvent.setup()
  renderLibrary([letter("Pending CV")])
  for (const request of [1, 2]) {
    await user.click(screen.getByRole("button", { name: "Pending CV menu" }))
    await user.click(
      await screen.findByRole("menuitem", { name: "Download PDF" })
    )
    expect(pending.load.mock.calls.length).toBeGreaterThanOrEqual(request)
  }
  expect(pending.print).not.toHaveBeenCalled()
  await act(async () => pending.release())
  expect(pending.print).toHaveBeenCalledTimes(1)
  expect(pending.error).not.toHaveBeenCalled()
  expect(document.body).not.toHaveAttribute("data-print")
})

it("CV editor name change restarts readiness without clearing the print request", async () => {
  const base = blankCv()
  fixture.client = seededCvClient({
    ...base,
    header: { ...base.header, name: "Ada Lovelace" },
  })
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ ok: true, data: {} }))
  )
  const pending = pendingPrint()
  const title = document.title
  renderEditor(
    <PaperCvEditor initial={record} pages={pages(1)} onBack={() => undefined} />
  )
  fireEvent.click(screen.getByRole("button", { name: "Download PDF" }))
  expect(pending.load).toHaveBeenCalled()
  fireEvent.change(screen.getByRole("textbox", { name: "Document name" }), {
    target: { value: "Renamed CV" },
  })
  expect(document.title).toBe("Renamed CV")
  await act(async () => pending.release())
  expect(pending.print).toHaveBeenCalledTimes(1)
  expect(pending.error).not.toHaveBeenCalled()
  expect(document.title).toBe(title)
})
