import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, screen, within } from "@testing-library/react"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe("Paper editor chrome", () => {
  it("opens the CV on a width-fit sheet with Name and Summary and no Coach float", async () => {
    renderApp(SURFACE_PATHS.paper)
    await expectPaperDrive()
    fireEvent.click(screen.getByRole("button", { name: /^PM track CV,/ }))
    const editor = await screen.findByRole("region", {
      name: "Editing PM track CV",
    })
    const view = within(editor)
    expect(view.getByRole("textbox", { name: "Name" })).toBeInTheDocument()
    expect(view.getByRole("textbox", { name: "Summary" })).toBeInTheDocument()
    expect(view.getByRole("button", { name: "Coach" })).toBeInTheDocument()
    expect(editor.querySelector('[data-paper-a4-fit="width"]')).not.toBeNull()
    expect(document.querySelector("[data-coach-float-pill]")).toBeNull()
  })
})
