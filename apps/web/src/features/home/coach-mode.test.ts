import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { coachModeHelper, coachModeLabel } from "@/features/home/coach-mode.ts"
import { renderApp } from "@/test/render-app.tsx"
import { getMockCoachMode } from "@/test/profile-api-mock.ts"
import { getLastCoachRequest } from "@/test/threads-api-mock.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function openModeMenu() {
  const trigger = await screen.findByRole("button", { name: "Coach mode" })
  await waitFor(() => {
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })
  fireEvent.click(trigger)
  return screen.findByRole("menu")
}

async function chooseMode(label: "Free" | "Light" | "Max") {
  const menu = await openModeMenu()
  fireEvent.click(within(menu).getByRole("menuitem", { name: label }))
  await waitFor(() => {
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })
}

describe("coach mode copy", () => {
  it("labels the three modes and stays honest about Free", () => {
    expect(coachModeLabel("free")).toBe("Free")
    expect(coachModeLabel("light")).toBe("Light")
    expect(coachModeLabel("max")).toBe("Max")
    expect(coachModeHelper("free")).toMatch(/free models/)
    expect(coachModeHelper("free")).toMatch(/change between turns/)
    expect(coachModeHelper("free")).not.toMatch(/unlimited/i)
    expect(coachModeHelper("max")).not.toMatch(/unlimited/i)
  })
})

describe("Home dock mode dropdown", () => {
  it("shows mode inside the idle dock and has no under-dock radiogroup", async () => {
    renderApp(SURFACE_PATHS.home)

    const trigger = await screen.findByRole("button", { name: "Coach mode" })
    expect(trigger).toHaveTextContent("Free")
    expect(
      screen.queryByRole("radiogroup", { name: "Coach mode" })
    ).not.toBeInTheDocument()

    const menu = await openModeMenu()
    expect(
      within(menu).getByRole("menuitem", { name: "Free" })
    ).toBeInTheDocument()
    expect(
      within(menu).getByRole("menuitem", { name: "Light" })
    ).toBeInTheDocument()
    expect(
      within(menu).getByRole("menuitem", { name: "Max" })
    ).toBeInTheDocument()
  })

  it("selects Free, Light, and Max and persists the preference", async () => {
    renderApp(SURFACE_PATHS.home)

    await chooseMode("Light")
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Coach mode" })).toHaveTextContent(
        "Light"
      )
      expect(getMockCoachMode()).toBe("light")
    })

    await chooseMode("Max")
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Coach mode" })).toHaveTextContent(
        "Max"
      )
      expect(getMockCoachMode()).toBe("max")
    })
  })

  it("keeps the chosen mode after remount, on the active Thread, and on the next send", async () => {
    const first = renderApp(SURFACE_PATHS.home)
    await chooseMode("Light")
    await waitFor(() => {
      expect(getMockCoachMode()).toBe("light")
    })
    first.unmount()

    renderApp(SURFACE_PATHS.home)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Coach mode" })).toHaveTextContent(
        "Light"
      )
    })
    expect(
      screen.queryByRole("radiogroup", { name: "Coach mode" })
    ).not.toBeInTheDocument()

    const composer = screen.getByRole("textbox", { name: "Message Coach" })
    fireEvent.change(composer, { target: { value: "Help me plan the week" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))

    await waitFor(() => {
      expect(getLastCoachRequest()?.mode).toBe("light")
    })
    expect(await screen.findByRole("log", { name: "Thread" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Coach mode" })).toHaveTextContent(
      "Light"
    )
    expect(
      screen.queryByRole("radiogroup", { name: "Coach mode" })
    ).not.toBeInTheDocument()
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
    expect(screen.getByText(/Free stays first/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "OpenRouter listing" })).toHaveAttribute(
      "href",
      "https://openrouter.ai/openrouter/free"
    )
    fireEvent.click(screen.getByRole("radio", { name: "Max" }))
    await waitFor(() => {
      expect(getMockCoachMode()).toBe("max")
    })
  })
})
