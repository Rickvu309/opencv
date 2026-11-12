import "@testing-library/jest-dom/vitest"
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"

import { Toaster, toastWithUndo } from "./sonner"

afterEach(cleanup)

it("shows the Undo toast at the top so it never covers the bottom-right Coach panel or its composer", async () => {
  const { container } = render(<Toaster />)
  act(() => {
    toastWithUndo("Edited CV.docx", () => undefined)
  })
  const toaster = await new Promise<HTMLElement | null>((resolve) =>
    setTimeout(
      () =>
        resolve(container.ownerDocument.querySelector("[data-sonner-toaster]")),
      0
    )
  )
  expect(toaster).not.toBeNull()
  expect(toaster).toHaveAttribute("data-y-position", "top")
  expect(toaster).toHaveAttribute("data-x-position", "center")
  expect(toaster!.style.getPropertyValue("--mobile-offset-top")).toBe(
    "calc(64px + env(safe-area-inset-top, 0px))"
  )
  expect(toaster!.style.getPropertyValue("--mobile-offset-bottom")).toBe("16px")
})
