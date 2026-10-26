import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { writeAimPromptState } from "@/features/home/aim-prompt.ts"
import {
  readFirstCafeState,
  writeFirstCafeState,
} from "@/features/home/first-cafe-checklist.ts"
import { goHome } from "@/test/go-home.ts"
import { renderApp } from "@/test/render-app.tsx"
import {
  expectHomeStarted,
  firstCafeList,
  firstCafeNudge,
  firstCafeQuietDone,
} from "@/test/home-helpers.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Home first-café next nudge", () => {
  it("shows one Pitch nudge after the sample CV win and stays skippable", async () => {
    const { router } = renderApp()
    await expectHomeStarted()

    fireEvent.click(screen.getByRole("link", { name: "Open the sample CV" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.paper)
    })

    await goHome()
    await expectHomeStarted()

    const nudge = firstCafeNudge()
    expect(
      within(nudge).getByText("Skip whenever. This is not a tour.")
    ).toBeInTheDocument()
    const next = within(nudge).getByRole("link", { name: "Make Pitch yours" })
    expect(next).toHaveAttribute("href", SURFACE_PATHS.pitch)
    expect(
      within(nudge).queryByRole("link", { name: "Triage one Apply card" })
    ).not.toBeInTheDocument()
    expect(
      within(nudge).queryByRole("link", { name: "Connect email, optional" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /next step|continue|skip tour/i })
    ).not.toBeInTheDocument()

    const list = firstCafeList()
    expect(
      within(list).getByRole("link", { name: "Open the sample CV, done" })
    ).toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Make Pitch yours, done" })
    ).not.toBeInTheDocument()

    fireEvent.click(within(nudge).getByRole("button", { name: "Skip" }))
    expect(
      screen.queryByRole("region", { name: "One next thing" })
    ).not.toBeInTheDocument()
    expect(firstCafeList()).toBeInTheDocument()

    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await screen.findByRole("region", { name: "Paper" })
    await goHome()
    await expectHomeStarted()

    expect(
      screen.queryByRole("region", { name: "One next thing" })
    ).not.toBeInTheDocument()
    expect(
      within(firstCafeList()).getByRole("link", {
        name: "Open the sample CV, done",
      })
    ).toBeInTheDocument()
    expect(
      within(firstCafeList()).queryByRole("link", {
        name: "Make Pitch yours, done",
      })
    ).not.toBeInTheDocument()
  })

  it("after Apply peek only, still nudges the sample CV and leaves Apply open", async () => {
    const { router } = renderApp()
    await expectHomeStarted()

    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    fireEvent.click(screen.getByRole("link", { name: "Triage one Apply card" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.apply)
    })

    await goHome()
    await expectHomeStarted()

    const nudge = firstCafeNudge()
    expect(
      within(nudge).getByRole("link", { name: "Open the sample CV" })
    ).toHaveAttribute("href", `${SURFACE_PATHS.paper}?open=sample`)
    expect(within(nudge).getAllByRole("link")).toHaveLength(1)

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
    expect(
      screen.queryByRole("region", { name: "You're set" })
    ).not.toBeInTheDocument()
  })

  it("treats Pitch clear as a win without checking Pitch on the list", async () => {
    writeFirstCafeState("user_test", {
      dismissed: false,
      completed: [],
      nudgeSkipped: false,
      wins: ["pitch"],
    })

    renderApp()
    await expectHomeStarted()

    const nudge = firstCafeNudge()
    expect(
      within(nudge).getByRole("link", { name: "Open the sample CV" })
    ).toHaveAttribute("href", `${SURFACE_PATHS.paper}?open=sample`)
    expect(within(nudge).getAllByRole("link")).toHaveLength(1)

    const list = firstCafeList()
    expect(
      within(list).getByRole("link", { name: "Make Pitch yours" })
    ).toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Make Pitch yours, done" })
    ).not.toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Open the sample CV, done" })
    ).not.toBeInTheDocument()
  })
})

function seedAimSkipped() {
  writeAimPromptState("user_test", { resolved: true, aimId: null })
}

describe("Home first-café quiet done", () => {
  it("hides Four small things after required wins and offers leftover Connect email", async () => {
    seedAimSkipped()
    writeFirstCafeState("user_test", {
      dismissed: false,
      completed: ["sample-cv", "pitch", "apply"],
      nudgeSkipped: false,
      wins: [],
    })

    const { router } = renderApp()
    await expectHomeStarted()

    expect(
      screen.queryByRole("heading", { name: "What are you aiming for?" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Four small things" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "One next thing" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /congratulat|celebrate|next step/i })
    ).not.toBeInTheDocument()

    const done = firstCafeQuietDone()
    expect(
      within(done).getByText("Skip whenever. This is not a tour.")
    ).toBeInTheDocument()
    const leftover = within(done).getByRole("link", {
      name: /Connect email/,
    })
    expect(leftover).toHaveAttribute(
      "href",
      `${SURFACE_PATHS.settings}?tab=apps`
    )
    expect(within(done).getAllByRole("link")).toHaveLength(1)
    expect(
      screen.getByRole("textbox", { name: "Message Coach" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Connect apps" })
    ).toBeInTheDocument()

    fireEvent.click(leftover)
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.settings)
      expect(router.state.location.search).toMatchObject({ tab: "apps" })
    })
  })

  it("lets Hide drop the leftover without bringing the checklist back", async () => {
    seedAimSkipped()
    writeFirstCafeState("user_test", {
      dismissed: false,
      completed: ["sample-cv", "pitch", "apply"],
      nudgeSkipped: false,
      wins: [],
    })

    renderApp()
    await expectHomeStarted()

    fireEvent.click(
      within(firstCafeQuietDone()).getByRole("button", { name: "Hide" })
    )
    expect(
      screen.queryByRole("region", { name: "You're set" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Four small things" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(
      screen.getByRole("textbox", { name: "Message Coach" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Connect apps" })
    ).toBeInTheDocument()
    expect(readFirstCafeState("user_test").nudgeSkipped).toBe(true)
    expect(readFirstCafeState("user_test").completed).toEqual([
      "sample-cv",
      "pitch",
      "apply",
    ])

    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await screen.findByRole("region", { name: "Paper" })
    await goHome()
    await expectHomeStarted()

    expect(
      screen.queryByRole("region", { name: "You're set" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Four small things" })
    ).not.toBeInTheDocument()
  })

  it("when every item is done, Home is greeting and composer only", async () => {
    seedAimSkipped()
    writeFirstCafeState("user_test", {
      dismissed: false,
      completed: ["sample-cv", "pitch", "apply", "email"],
      nudgeSkipped: false,
      wins: [],
    })

    renderApp()
    await expectHomeStarted()

    expect(
      screen.queryByRole("heading", { name: "Four small things" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "You're set" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "One next thing" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(
      screen.getByRole("textbox", { name: "Message Coach" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Connect apps" })
    ).toBeInTheDocument()
  })
})
