import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, screen, within } from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe("Paper selection chrome", () => {
  it("keeps Coach and Undo and drops the unsaved marks", async () => {
    renderApp(SURFACE_PATHS.paper)
    await expectPaperDrive()
    const card = () =>
      screen.getByRole("button", { name: /^Open PM track CV,/ })
    fireEvent.click(card())
    fireEvent.click(card())
    const editor = await screen.findByRole("region", {
      name: "Editing PM track CV",
    })
    const toolbar = within(editor).getByRole("toolbar", { name: "Selection" })
    expect(
      within(toolbar).getByRole("button", { name: "Coach" })
    ).toBeInTheDocument()
    expect(
      within(toolbar).getByRole("button", { name: "Undo" })
    ).toBeInTheDocument()
    expect(
      within(toolbar).queryByRole("button", { name: "Bold" })
    ).not.toBeInTheDocument()
    expect(
      within(toolbar).queryByRole("button", { name: "Italic" })
    ).not.toBeInTheDocument()
    expect(
      within(toolbar).queryByRole("button", { name: "Underline" })
    ).not.toBeInTheDocument()
  })
})
