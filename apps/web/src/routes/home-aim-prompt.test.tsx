import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { HOME_PATH, SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { AIM_OPTIONS } from "@/features/home/aim-prompt.ts"
import { readFirstCafeState } from "@/features/home/first-cafe-checklist.ts"
import { goHome } from "@/test/go-home.ts"
import { renderApp } from "@/test/render-app.tsx"
import {
  expectHomeStarted,
  firstCafeList,
  firstCafeNudge,
} from "@/test/home-helpers.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Home optional aim prompt", () => {
  it("asks once on idle Home and Skip always dismisses it", async () => {
    const { router } = renderApp()
    await expectHomeStarted()

    expect(
      screen.getByRole("heading", { name: "What are you aiming for?" })
    ).toBeInTheDocument()
    expect(screen.getByText("Optional. Skip whenever.")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "I'm not sure yet" })
    ).toBeInTheDocument()
    for (const option of AIM_OPTIONS) {
      expect(
        screen.getByRole("button", { name: option.label })
      ).toBeInTheDocument()
    }
    expect(
      screen.queryByRole("button", { name: /next step|continue|skip tour/i })
    ).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe(HOME_PATH)

    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    expect(
      screen.queryByRole("heading", { name: "What are you aiming for?" })
    ).not.toBeInTheDocument()

    const nudge = firstCafeNudge()
    expect(
      within(nudge).getByText("Skip whenever. This is not a tour.")
    ).toBeInTheDocument()
    expect(
      within(nudge).getByRole("link", { name: "Open the sample CV" })
    ).toHaveAttribute("href", `${SURFACE_PATHS.paper}?open=sample`)
    expect(within(nudge).getAllByRole("link")).toHaveLength(1)
    expect(
      screen.queryByRole("button", { name: /next step|continue|skip tour/i })
    ).not.toBeInTheDocument()

    const list = firstCafeList()
    expect(
      within(list).getByRole("link", { name: "Open the sample CV" })
    ).toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Open the sample CV, done" })
    ).not.toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Make Pitch yours, done" })
    ).not.toBeInTheDocument()
    expect(readFirstCafeState("user_test").completed).toEqual([])

    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await screen.findByRole("region", { name: "Paper" })
    await goHome()
    await expectHomeStarted()

    expect(
      screen.queryByRole("heading", { name: "What are you aiming for?" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Four small things" })
    ).toBeInTheDocument()
    expect(firstCafeNudge()).toBeInTheDocument()
  })

  it("after Skip aim, the first nudge is dismissible and checks nothing", async () => {
    renderApp()
    await expectHomeStarted()

    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    const nudge = firstCafeNudge()
    expect(
      within(nudge).getByText("Skip whenever. This is not a tour.")
    ).toBeInTheDocument()

    fireEvent.click(within(nudge).getByRole("button", { name: "Skip" }))
    expect(
      screen.queryByRole("region", { name: "One next thing" })
    ).not.toBeInTheDocument()
    expect(firstCafeList()).toBeInTheDocument()
    expect(
      within(firstCafeList()).queryByRole("link", {
        name: "Open the sample CV, done",
      })
    ).not.toBeInTheDocument()
    expect(
      within(firstCafeList()).queryByRole("link", {
        name: "Make Pitch yours, done",
      })
    ).not.toBeInTheDocument()
    expect(readFirstCafeState("user_test").completed).toEqual([])
    expect(readFirstCafeState("user_test").nudgeSkipped).toBe(true)

    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await screen.findByRole("region", { name: "Paper" })
    await goHome()
    await expectHomeStarted()

    expect(
      screen.queryByRole("region", { name: "One next thing" })
    ).not.toBeInTheDocument()
    expect(firstCafeList()).toBeInTheDocument()
  })

  it("after Skip aim then Apply only, does not check Sample, Pitch, or Apply", async () => {
    const { router } = renderApp()
    await expectHomeStarted()

    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    expect(firstCafeNudge()).toBeInTheDocument()
    expect(readFirstCafeState("user_test").completed).toEqual([])

    fireEvent.click(screen.getByRole("link", { name: "Triage one Apply card" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.apply)
    })

    await goHome()
    await expectHomeStarted()

    expect(readFirstCafeState("user_test").completed).toEqual([])
    const list = firstCafeList()
    expect(
      within(list).getByRole("link", { name: "Triage one Apply card" })
    ).toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Triage one Apply card, done" })
    ).not.toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Open the sample CV, done" })
    ).not.toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Make Pitch yours, done" })
    ).not.toBeInTheDocument()

    const nudge = firstCafeNudge()
    expect(
      within(nudge).getByRole("link", { name: "Open the sample CV" })
    ).toHaveAttribute("href", `${SURFACE_PATHS.paper}?open=sample`)
  })

  it("lets I'm not sure yet skip without checking Pitch or Apply", async () => {
    renderApp()
    await expectHomeStarted()

    fireEvent.click(screen.getByRole("button", { name: "I'm not sure yet" }))
    expect(
      screen.queryByRole("heading", { name: "What are you aiming for?" })
    ).not.toBeInTheDocument()
    expect(
      within(firstCafeNudge()).getByRole("link", { name: "Open the sample CV" })
    ).toBeInTheDocument()
    const list = firstCafeList()
    expect(
      within(list).getByRole("link", { name: "Make Pitch yours" })
    ).toBeInTheDocument()
    expect(
      within(list).getByRole("link", { name: "Triage one Apply card" })
    ).toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Make Pitch yours, done" })
    ).not.toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Triage one Apply card, done" })
    ).not.toBeInTheDocument()
    expect(readFirstCafeState("user_test").completed).toEqual([])
    expect(
      screen.queryByRole("region", { name: "You're set" })
    ).not.toBeInTheDocument()
  })

  it("does not reboot into an /onboarding multi-step flow", async () => {
    renderApp("/onboarding")
    expect(screen.queryByText(/step 1 of/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: /what's your school|pick a goal/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /next step|continue|skip tour/i })
    ).not.toBeInTheDocument()
  })
})
