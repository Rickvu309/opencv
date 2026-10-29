import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { coachModeHelper, coachModeLabel } from "@/features/coach/coach-mode.ts"
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
  const group = await screen.findByRole("radiogroup", { name: "Coach mode" })
  fireEvent.click(
    within(group).getByRole("radio", {
      name: label === "Free" ? label : `${label} · Pro`,
    })
  )
}

function expectChecked(group: HTMLElement, label: string) {
  expect(
    within(group).getByRole("radio", {
      name: label === "Free" ? label : `${label} · Pro`,
    })
  ).toBeChecked()
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

describe("Coach mode control", () => {
  it("shows Free, Light, Max in order as one radiogroup in the composer", async () => {
    renderApp(SURFACE_PATHS.coach)

    const group = await screen.findByRole("radiogroup", { name: "Coach mode" })
    expect(
      within(group)
        .getAllByRole("radio")
        .map((radio) => radio.textContent)
    ).toEqual([expect.stringMatching(/^Free/), "Light · Pro", "Max · Pro"])
    expectChecked(group, "Free")
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument()
  })

  it("selects Free, Light, and Max and stores Max as max", async () => {
    setMockPlan("pro")
    renderApp(SURFACE_PATHS.coach)

    await chooseMode("Light")
    await waitFor(() => {
      expectChecked(
        screen.getByRole("radiogroup", { name: "Coach mode" }),
        "Light"
      )
      expect(getMockCoachMode()).toBe("light")
    })

    await chooseMode("Max")
    await waitFor(() => {
      expectChecked(
        screen.getByRole("radiogroup", { name: "Coach mode" }),
        "Max"
      )
      expect(getMockCoachMode()).toBe("max")
    })
    expect(getProfileMockPaths()).toContain("/api/commands/profile.update")
    expect(getProfileMockPaths().join(" ")).not.toContain("setCoachMode")
  })

  it("moves the mode with the arrow keys", async () => {
    setMockPlan("pro")
    renderApp(SURFACE_PATHS.coach)

    const group = await screen.findByRole("radiogroup", { name: "Coach mode" })
    const free = within(group).getByRole("radio", { name: "Free" })
    free.focus()
    fireEvent.keyDown(free, { key: "ArrowRight" })
    await waitFor(() => {
      expect(getMockCoachMode()).toBe("light")
    })
    fireEvent.keyDown(
      within(group).getByRole("radio", { name: "Light · Pro" }),
      {
        key: "ArrowRight",
      }
    )
    await waitFor(() => {
      expect(getMockCoachMode()).toBe("max")
    })
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
      expectChecked(
        screen.getByRole("radiogroup", { name: "Coach mode" }),
        "Light"
      )
    })

    const composer = screen.getByRole("textbox", { name: "Message Coach" })
    fireEvent.change(composer, { target: { value: "Help me plan the week" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))

    await waitFor(() => {
      expect(getLastCoachRequest()?.mode).toBe("light")
    })
    expect(await screen.findByRole("log", { name: "Chat" })).toBeInTheDocument()
    expectChecked(
      screen.getByRole("radiogroup", { name: "Coach mode" }),
      "Light"
    )
  })
})
