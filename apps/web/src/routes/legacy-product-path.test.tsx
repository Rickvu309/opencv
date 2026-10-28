import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor } from "@testing-library/react"

import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("legacy product paths", () => {
  it("opens Coach at /coach and keeps the query and hash", async () => {
    const { router } = renderApp("/app/coach?x=1#h")

    expect(await screen.findByRole("textbox")).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.href).toBe("/coach?x=1#h")
    })
    expect(router.state.location.pathname).toBe("/coach")
    expect(router.state.location.hash).toBe("h")
  })
})
