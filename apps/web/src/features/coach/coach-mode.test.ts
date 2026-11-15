import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import {
  COACH_MODE_LOCKED,
  coachModeHelper,
  coachModeLabel,
} from "@/features/coach/coach-mode.ts"
import { renderApp } from "@/test/render-app.tsx"
import {
  getMockCoachMode,
  getProfileMockPaths,
  setMockPlan,
} from "@/test/profile-api-mock.ts"
import { getLastCoachRequest } from "@/test/chat-api-mock.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function chooseMode(label: "Free" | "Light" | "Max") {
  const trigger = await screen.findByRole("button", {
    name: "Choose Coach mode",
  })
  fireEvent.click(trigger)
  const item = await screen.findByRole("menuitemradio", {
    name: new RegExp(label),
  })
  fireEvent.click(item)
}

function expectModeSelected(label: string) {
  const trigger = screen.getByRole("button", { name: "Choose Coach mode" })
  expect(trigger.textContent).toMatch(new RegExp(label, "i"))
}

describe("coach mode copy", () => {
  it("labels the three modes and stays honest about Free", () => {
    expect(coachModeLabel("free")).toBe("Free")
    expect(coachModeLabel("light")).toBe("Light")
    expect(coachModeLabel("max")).toBe("Max")
    for (const mode of ["free", "light", "max"] as const) {
      expect(coachModeHelper(mode)).toMatch(/daily limit/)
      expect(coachModeHelper(mode)).not.toMatch(
        /OpenRouter|model|stronger|larger|quality|careful/i
      )
    }
    expect(coachModeHelper("free")).not.toMatch(/unlimited/i)
    expect(coachModeHelper("max")).not.toMatch(/unlimited/i)
  })
})

describe("Coach mode control", () => {
  it("shows Free, Light, Max in order in the mode picker", async () => {
    renderApp(SURFACE_PATHS.coach)

    const trigger = await screen.findByRole("button", {
      name: "Choose Coach mode",
    })
    expect(trigger.textContent).toMatch(/Free/)
    fireEvent.click(trigger)

    const items = await screen.findAllByRole("menuitemradio")
    expect(items.map((i) => i.textContent?.trim())).toEqual([
      expect.stringMatching(/^Free/),
      expect.stringMatching(/^Light/),
      expect.stringMatching(/^Max/),
    ])
  })

  it("shows Light and Max as unavailable with a visible reason on Free and keeps Free", async () => {
    setMockPlan("free")
    renderApp(SURFACE_PATHS.coach)
    fireEvent.click(
      await screen.findByRole("button", { name: "Choose Coach mode" })
    )
    const max = await screen.findByRole("menuitemradio", { name: "Max · Pro" })
    expect(max).toHaveAttribute("aria-disabled", "true")
    expect(max).toHaveAccessibleDescription(COACH_MODE_LOCKED)
    expect(max).toHaveTextContent(COACH_MODE_LOCKED)
    const free = screen.getByRole("menuitemradio", { name: "Free" })
    expect(free).toHaveTextContent(coachModeHelper("free"))
    fireEvent.click(max)
    expect(
      screen.getByRole("menuitemradio", { name: "Max · Pro" })
    ).toBeVisible()
    expectModeSelected("Free")
    expect(getMockCoachMode()).toBe("free")
  })

  it("selects Free, Light, and Max and stores Max as max", async () => {
    setMockPlan("pro")
    renderApp(SURFACE_PATHS.coach)

    await chooseMode("Light")
    await waitFor(() => {
      expectModeSelected("Light")
      expect(getMockCoachMode()).toBe("light")
    })

    await chooseMode("Max")
    await waitFor(() => {
      expectModeSelected("Max")
      expect(getMockCoachMode()).toBe("max")
    })
    expect(getProfileMockPaths()).toContain("/api/commands/profile.update")
    expect(getProfileMockPaths().join(" ")).not.toContain("setCoachMode")
  })

  it("keeps the chosen mode after remount, on the active Chat, and on the next send", async () => {
    setMockPlan("pro")
    const first = renderApp(SURFACE_PATHS.coach)
    await chooseMode("Light")
    await waitFor(() => {
      expect(getMockCoachMode()).toBe("light")
    })
    first.unmount()

    renderApp(SURFACE_PATHS.coach)
    await waitFor(() => {
      expectModeSelected("Light")
    })

    const composer = screen.getByRole("textbox", { name: "Message Coach" })
    fireEvent.change(composer, { target: { value: "Help me plan the week" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))

    await waitFor(() => {
      expect(getLastCoachRequest()?.mode).toBe("light")
    })
    expect(await screen.findByRole("log", { name: "Chat" })).toBeInTheDocument()
    expectModeSelected("Light")
  })
})
