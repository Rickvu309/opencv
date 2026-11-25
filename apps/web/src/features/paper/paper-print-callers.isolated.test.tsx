import { afterEach, beforeAll, expect, it, vi } from "vitest"
import { act, cleanup, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { letter, renderLibrary } from "./paper-library.fixtures.tsx"
import { installEditorPolyfills } from "@/test/editor-polyfills.ts"

beforeAll(installEditorPolyfills)

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
