import { expect, it, vi } from "vitest"
import { installTestFonts } from "./font-face-set"

it("provides ready, iterable fonts and removable loading listeners to every caller", async () => {
  const fonts = installTestFonts()
  expect(await document.fonts.ready).toBe(fonts)
  expect(document.fonts.status).toBe("loaded")
  expect(document.fonts.check("12px Arial")).toBe(true)
  expect(await document.fonts.load("12px Arial")).toEqual([])
  expect([...document.fonts]).toEqual([])
  const loaded = vi.fn()
  document.fonts.addEventListener("loadingdone", loaded)
  document.fonts.dispatchEvent(new Event("loadingdone"))
  expect(loaded).toHaveBeenCalledTimes(1)
  document.fonts.removeEventListener("loadingdone", loaded)
  document.fonts.dispatchEvent(new Event("loadingdone"))
  expect(loaded).toHaveBeenCalledTimes(1)
})
