import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, screen, within } from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe("Paper Coach entry", () => {
  it("puts the Coach button on the editor, not a second float", async () => {
    renderApp(SURFACE_PATHS.paper)
    await expectPaperDrive()
    const card = () =>
      screen.getByRole("button", { name: /^Open PM track CV,/ })
    fireEvent.click(card())
    fireEvent.click(card())
    const editor = await screen.findByRole("region", {
      name: "Editing PM track CV",
    })
    expect(
      within(editor).getByRole("button", { name: "Coach" })
    ).toBeInTheDocument()
    expect(document.querySelector("[data-coach-float-pill]")).toBeNull()
  })
})
