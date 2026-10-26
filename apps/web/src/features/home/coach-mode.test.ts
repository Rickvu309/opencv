import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { HOME_PATH } from "@/features/app-shell/surfaces.ts"
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

async function chooseMode(label: "Free" | "Light" | "Power") {
  const group = await screen.findByRole("radiogroup", { name: "Coach mode" })
  fireEvent.click(within(group).getByRole("radio", { name: label }))
}

function expectChecked(group: HTMLElement, label: string) {
  expect(within(group).getByRole("radio", { name: label })).toBeChecked()
}

describe("coach mode copy", () => {
  it("labels the three modes and stays honest about Free", () => {
    expect(coachModeLabel("free")).toBe("Free")
    expect(coachModeLabel("light")).toBe("Light")
    expect(coachModeLabel("max")).toBe("Power")
    expect(coachModeHelper("free")).toMatch(/free models/)
    expect(coachModeHelper("free")).toMatch(/change between turns/)
    expect(coachModeHelper("free")).not.toMatch(/unlimited/i)
    expect(coachModeHelper("max")).not.toMatch(/unlimited/i)
  })
})

describe("Home dock mode control", () => {
  it("shows Free, Light, Power in order as one radiogroup in the dock", async () => {
    renderApp(HOME_PATH)

    const group = await screen.findByRole("radiogroup", { name: "Coach mode" })
    expect(
      within(group)
        .getAllByRole("radio")
        .map((radio) => radio.textContent)
    ).toEqual(["Free", "Light", "Power"])
    expectChecked(group, "Free")
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument()
  })

  it("selects Free, Light, and Power and stores Power as max", async () => {
    renderApp(HOME_PATH)

    await chooseMode("Light")
    await waitFor(() => {
      expectChecked(
        screen.getByRole("radiogroup", { name: "Coach mode" }),
        "Light"
      )
      expect(getMockCoachMode()).toBe("light")
    })

    await chooseMode("Power")
    await waitFor(() => {
      expectChecked(
        screen.getByRole("radiogroup", { name: "Coach mode" }),
        "Power"
      )
      expect(getMockCoachMode()).toBe("max")
    })
  })

  it("moves the mode with the arrow keys", async () => {
    renderApp(HOME_PATH)

    const group = await screen.findByRole("radiogroup", { name: "Coach mode" })
    const free = within(group).getByRole("radio", { name: "Free" })
    free.focus()
    fireEvent.keyDown(free, { key: "ArrowRight" })
    await waitFor(() => {
      expect(getMockCoachMode()).toBe("light")
    })
    fireEvent.keyDown(within(group).getByRole("radio", { name: "Light" }), {
      key: "ArrowRight",
    })
    await waitFor(() => {
      expect(getMockCoachMode()).toBe("max")
    })
  })

  it("keeps the chosen mode after remount, on the active Thread, and on the next send", async () => {
    const first = renderApp(HOME_PATH)
    await chooseMode("Light")
    await waitFor(() => {
      expect(getMockCoachMode()).toBe("light")
    })
    first.unmount()

    renderApp(HOME_PATH)
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
    expect(
      await screen.findByRole("log", { name: "Thread" })
    ).toBeInTheDocument()
    expectChecked(
      screen.getByRole("radiogroup", { name: "Coach mode" }),
      "Light"
    )
  })
})

describe("Settings coach mode", () => {
  it("sends a Pro mode to the upgrade screen and keeps Free stored", async () => {
    renderApp("/app/settings/coach")

    expect(
      await screen.findByRole("radiogroup", { name: "Coach mode" })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("radio", { name: "Light" }))
    await screen.findByText("Billing is not open yet.")
    expect(screen.getByText("Billing is not open yet.")).toBeInTheDocument()
    expect(getMockCoachMode()).toBe("free")
  })
})
