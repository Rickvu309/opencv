import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, screen, within } from "@testing-library/react"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe("Paper selection chrome", () => {
  it("names Bold, Italic, and Underline inside the editor", async () => {
    renderApp(SURFACE_PATHS.paper)
    await expectPaperDrive()
    fireEvent.click(screen.getByRole("button", { name: /^PM track CV,/ }))
    const editor = await screen.findByRole("region", {
      name: "Editing PM track CV",
    })
    const toolbar = within(editor).getByRole("toolbar", { name: "Selection" })
    expect(
      within(toolbar).getByRole("button", { name: "Bold" })
    ).toBeInTheDocument()
    expect(
      within(toolbar).getByRole("button", { name: "Italic" })
    ).toBeInTheDocument()
    expect(
      within(toolbar).getByRole("button", { name: "Underline" })
    ).toBeInTheDocument()
  })
})
