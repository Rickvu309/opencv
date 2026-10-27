import { afterEach, describe, expect, it } from "vitest"
import { cleanup, screen } from "@testing-library/react"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe("Paper Coach button", () => {
  it("does not mount a second Coach float on the library", async () => {
    renderApp(SURFACE_PATHS.paper)
    await expectPaperDrive()
    expect(document.querySelector("[data-coach-float-pill]")).toBeNull()
    expect(screen.getByRole("button", { name: "Coach" })).toBeInTheDocument()
  })
})
