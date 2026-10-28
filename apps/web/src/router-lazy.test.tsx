import { act, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const loaded = vi.hoisted(() => ({ paper: 0, apply: 0 }))

vi.mock("@/routes/paper.tsx", async () => {
  const { createElement } = await import("react")
  loaded.paper += 1
  return { PaperPage: () => createElement("h1", null, "Paper stub") }
})

vi.mock("@/routes/apply.tsx", async () => {
  const { createElement } = await import("react")
  loaded.apply += 1
  return { ApplyPage: () => createElement("h1", null, "Apply stub") }
})

describe("lazy routes", () => {
  it("does not load route modules until the route is visited", async () => {
    const { renderApp } = await import("@/test/render-app.tsx")
    expect(loaded.paper).toBe(0)
    expect(loaded.apply).toBe(0)

    const { router } = renderApp("/coach")
    await screen.findByRole("main")
    expect(loaded.paper).toBe(0)
    expect(loaded.apply).toBe(0)

    await act(() => router.navigate({ to: "/paper" }))
    expect(
      await screen.findByRole("heading", { name: "Paper stub" })
    ).toBeInTheDocument()
    expect(loaded.paper).toBe(1)
    expect(loaded.apply).toBe(0)
  })
})
