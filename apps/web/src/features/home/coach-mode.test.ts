import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { coachModeHelper, coachModeLabel } from "@/features/home/coach-mode.ts"
import { renderApp } from "@/test/render-app.tsx"
import { getMockCoachMode } from "@/test/profile-api-mock.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("coach mode copy", () => {
  it("labels the three modes and stays honest about Free", () => {
    expect(coachModeLabel("free")).toBe("Free")
    expect(coachModeLabel("light")).toBe("Light")
    expect(coachModeLabel("max")).toBe("Max")
    expect(coachModeHelper("free")).toMatch(/preview/)
    expect(coachModeHelper("free")).not.toMatch(/unlimited/i)
    expect(coachModeHelper("max")).not.toMatch(/unlimited/i)
  })
})

describe("Home composer mode selector", () => {
  it("selects Free, Light, and Max and persists the preference", async () => {
    renderApp(SURFACE_PATHS.home)

    const group = await screen.findByRole("radiogroup", { name: "Coach mode" })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Free" })).toHaveAttribute(
      "aria-checked",
      "true"
    )

    fireEvent.click(screen.getByRole("radio", { name: "Light" }))
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute(
        "aria-checked",
        "true"
      )
      expect(getMockCoachMode()).toBe("light")
    })

    fireEvent.click(screen.getByRole("radio", { name: "Max" }))
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "Max" })).toHaveAttribute(
        "aria-checked",
        "true"
      )
      expect(getMockCoachMode()).toBe("max")
    })
  })
})

describe("Settings coach mode", () => {
  it("shows the same three-way control on General", async () => {
    renderApp(SURFACE_PATHS.settings)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Settings" })
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("radiogroup", { name: "Coach mode" })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("radio", { name: "Max" }))
    await waitFor(() => {
      expect(getMockCoachMode()).toBe("max")
    })
  })
})
