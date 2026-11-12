import "@testing-library/jest-dom/vitest"
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"

import { Toaster, toastWithUndo } from "./components/sonner"
import { TOAST_OFFSET_BOTTOM } from "./lib/toast-offset"

afterEach(cleanup)

async function shownToaster(container: HTMLElement) {
  act(() => {
    toastWithUndo("Edited CV.docx", () => undefined)
  })
  return new Promise<HTMLElement | null>((resolve) =>
    setTimeout(
      () =>
        resolve(container.ownerDocument.querySelector("[data-sonner-toaster]")),
      0
    )
  )
}

it("keeps toasts in the bottom right corner, lifted by the offset the app shell reports", async () => {
  const { container } = render(<Toaster />)
  const toaster = await shownToaster(container)
  expect(toaster).not.toBeNull()
  expect(toaster).toHaveAttribute("data-y-position", "bottom")
  expect(toaster).toHaveAttribute("data-x-position", "right")
  expect(toaster!.style.getPropertyValue("--offset-bottom")).toBe(
    `var(${TOAST_OFFSET_BOTTOM}, 24px)`
  )
  expect(toaster!.style.getPropertyValue("--mobile-offset-bottom")).toBe(
    `var(${TOAST_OFFSET_BOTTOM}, 16px)`
  )
  expect(toaster!.style.getPropertyValue("--offset-right")).toBe("24px")
})
