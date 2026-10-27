import { afterEach, describe, expect, it } from "vitest"
import { cleanup } from "@testing-library/react"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe("Paper cites", () => {
  it("keeps the library free of the retired cite float", async () => {
    renderApp(SURFACE_PATHS.paper)
    await expectPaperDrive()
    expect(document.querySelector("[data-coach-float-pill]")).toBeNull()
  })
})
