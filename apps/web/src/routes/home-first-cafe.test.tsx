import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
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

describe("Home first-café checklist", () => {
  it("shows at most four dismissible first moves with real deep-links", async () => {
    renderApp()
    await expectHomeStarted()

    expect(
      screen.getByRole("heading", { name: "Four small things" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Skip whenever. This is not a tour.")
    ).toBeInTheDocument()

    const sampleCv = screen.getByRole("link", { name: "Open the sample CV" })
    const pitch = screen.getByRole("link", { name: "Make Pitch yours" })
    const apply = screen.getByRole("link", { name: "Triage one Apply card" })
    const email = screen.getByRole("link", { name: "Connect email, optional" })

    expect(sampleCv).toHaveAttribute(
      "href",
      `${SURFACE_PATHS.paper}?open=sample`
    )
    expect(pitch).toHaveAttribute("href", SURFACE_PATHS.pitch)
    expect(apply).toHaveAttribute("href", `${SURFACE_PATHS.apply}?open=guide`)
    expect(email).toHaveAttribute("href", `${SURFACE_PATHS.settings}?tab=apps`)

    expect(
      screen.queryByRole("region", { name: "One next thing" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /next step|continue|skip tour/i })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Hide this" }))
    expect(
      screen.queryByRole("heading", { name: "Four small things" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Open the sample CV" })
    ).not.toBeInTheDocument()
  })

  it("keeps the list hidden after dismiss and remount", async () => {
    renderApp()
    await expectHomeStarted()

    fireEvent.click(screen.getByRole("button", { name: "Hide this" }))
    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await screen.findByRole("region", { name: "Paper" })
    await goHome()
    await expectHomeStarted()

    expect(
      screen.queryByRole("heading", { name: "Four small things" })
    ).not.toBeInTheDocument()
    expect(firstCafeNudge()).toBeInTheDocument()
    expect(
      within(firstCafeNudge()).getByRole("link", { name: "Make Pitch yours" })
    ).toHaveAttribute("href", SURFACE_PATHS.pitch)
  })

  it("auto-completes an item after the User visits the linked surface", async () => {
    const { router } = renderApp()
    await expectHomeStarted()

    fireEvent.click(screen.getByRole("link", { name: "Open the sample CV" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.paper)
      expect(router.state.location.search).toMatchObject({ open: "sample" })
    })

    await goHome()
    await expectHomeStarted()

    const list = firstCafeList()
    expect(
      within(list).getByRole("link", { name: "Open the sample CV, done" })
    ).toBeInTheDocument()
    expect(
      within(list).getByRole("link", { name: "Make Pitch yours" })
    ).toBeInTheDocument()
    expect(
      within(list).getByRole("link", { name: "Triage one Apply card" })
    ).toBeInTheDocument()
    expect(
      within(list).getByRole("link", { name: "Connect email, optional" })
    ).toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Triage one Apply card, done" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /next step|continue/i })
    ).not.toBeInTheDocument()
  })

  it("does not complete Apply after opening the board without a triage", async () => {
    const { router } = renderApp()
    await expectHomeStarted()

    expect(
      screen.getByRole("link", { name: "Triage one Apply card" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("link", { name: "Triage one Apply card" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.apply)
      expect(router.state.location.search).toMatchObject({ open: "guide" })
    })
    expect(
      await screen.findByRole("heading", { level: 1, name: "Apply" })
    ).toBeInTheDocument()

    await goHome()
    await expectHomeStarted()

    const list = firstCafeList()
    expect(
      within(list).getByRole("link", { name: "Triage one Apply card" })
    ).toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Triage one Apply card, done" })
    ).not.toBeInTheDocument()
    expect(
      within(list).getByRole("link", { name: "Open the sample CV" })
    ).toBeInTheDocument()
    expect(
      within(list).getByRole("link", { name: "Make Pitch yours" })
    ).toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Open the sample CV, done" })
    ).not.toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Make Pitch yours, done" })
    ).not.toBeInTheDocument()
    expect(readFirstCafeState("user_test").completed).toEqual([])
    expect(
      screen.queryByRole("region", { name: "You're set" })
    ).not.toBeInTheDocument()
  })

  it("does not complete Sample or Pitch when sibling nav preloads on Apply", async () => {
    const { router } = renderApp()
    await expectHomeStarted()

    fireEvent.click(screen.getByRole("link", { name: "Triage one Apply card" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.apply)
    })
    expect(
      await screen.findByRole("heading", { level: 1, name: "Apply" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "Paper" })
    ).not.toBeInTheDocument()

    fireEvent.mouseEnter(screen.getByRole("link", { name: "Paper" }))
    fireEvent.focus(screen.getByRole("link", { name: "Paper" }))
    fireEvent.mouseEnter(screen.getByRole("link", { name: "Pitch" }))
    fireEvent.focus(screen.getByRole("link", { name: "Pitch" }))

    expect(router.state.location.pathname).toBe(SURFACE_PATHS.apply)
    expect(
      screen.getByRole("heading", { level: 1, name: "Apply" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "Paper" })
    ).not.toBeInTheDocument()

    await goHome()
    await expectHomeStarted()

    const list = firstCafeList()
    expect(
      within(list).queryByRole("link", { name: "Triage one Apply card, done" })
    ).not.toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Open the sample CV, done" })
    ).not.toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Make Pitch yours, done" })
    ).not.toBeInTheDocument()
    expect(readFirstCafeState("user_test").completed).toEqual([])
  })

  it("does not complete Pitch after opening the demo without an edit", async () => {
    const { router } = renderApp()
    await expectHomeStarted()

    fireEvent.click(screen.getByRole("link", { name: "Make Pitch yours" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.pitch)
    })

    await goHome()
    await expectHomeStarted()

    const list = firstCafeList()
    expect(
      within(list).getByRole("link", { name: "Make Pitch yours" })
    ).toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Make Pitch yours, done" })
    ).not.toBeInTheDocument()
    expect(
      within(list).getByRole("link", { name: "Open the sample CV" })
    ).toBeInTheDocument()
    expect(
      within(list).getByRole("link", { name: "Triage one Apply card" })
    ).toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Open the sample CV, done" })
    ).not.toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Triage one Apply card, done" })
    ).not.toBeInTheDocument()
    expect(readFirstCafeState("user_test").completed).toEqual([])
  })

  it("opens one seeded Apply card with a Prep next action and keeps the board", async () => {
    const { router } = renderApp()
    await expectHomeStarted()

    fireEvent.click(screen.getByRole("link", { name: "Triage one Apply card" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.apply)
      expect(router.state.location.search).toMatchObject({ open: "guide" })
    })

    const panel = await screen.findByRole("complementary", {
      name: "Opportunity detail",
    })
    expect(
      within(panel).getByDisplayValue("Associate PM intern")
    ).toBeInTheDocument()
    expect(
      within(panel).getByRole("button", { name: "Move to Prep" })
    ).toBeInTheDocument()
    expect(
      within(panel).getByRole("combobox", { name: "Track" })
    ).toHaveTextContent("Follow-up")

    expect(screen.getByText("Product intern")).toBeInTheDocument()
    expect(screen.getByText("Business analyst intern")).toBeInTheDocument()
    expect(screen.getByText("Product analyst intern")).toBeInTheDocument()
    expect(screen.getByText("UX research intern")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /skip tour|continue tour/i })
    ).not.toBeInTheDocument()

    fireEvent.click(within(panel).getByRole("button", { name: "Move to Prep" }))
    await waitFor(() => {
      expect(
        within(
          document.querySelector('[data-stage="prep"]') as HTMLElement
        ).getByText("Associate PM intern")
      ).toBeInTheDocument()
    })
    expect(
      within(
        document.querySelector('[data-stage="inbox"]') as HTMLElement
      ).queryByText("Associate PM intern")
    ).not.toBeInTheDocument()
    expect(
      within(
        document.querySelector('[data-stage="inbox"]') as HTMLElement
      ).getByText("Product intern")
    ).toBeInTheDocument()
    expect(
      within(
        document.querySelector('[data-stage="prep"]') as HTMLElement
      ).getByText("Business analyst intern")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Move to Prep" })
    ).not.toBeInTheDocument()
    expect(
      within(
        await screen.findByRole("complementary", { name: "Opportunity detail" })
      ).getByRole("combobox", { name: "Track" })
    ).toHaveTextContent("Follow-up")

    await goHome()
    await expectHomeStarted()
    expect(
      within(firstCafeList()).getByRole("link", {
        name: "Triage one Apply card, done",
      })
    ).toBeInTheDocument()
    expect(
      within(firstCafeList()).queryByRole("link", {
        name: "Make Pitch yours, done",
      })
    ).not.toBeInTheDocument()
    expect(readFirstCafeState("user_test").completed).toEqual(["apply"])
  })

  it("peeking Paper / Pitch / Apply does not reach You're set", async () => {
    const { router } = renderApp()
    await expectHomeStarted()

    fireEvent.click(screen.getByRole("button", { name: "I'm not sure yet" }))
    expect(
      within(firstCafeList()).queryByRole("link", {
        name: "Make Pitch yours, done",
      })
    ).not.toBeInTheDocument()
    expect(
      within(firstCafeList()).queryByRole("link", {
        name: "Triage one Apply card, done",
      })
    ).not.toBeInTheDocument()

    fireEvent.click(
      within(firstCafeList()).getByRole("link", { name: "Open the sample CV" })
    )
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.paper)
    })
    await goHome()
    await expectHomeStarted()

    fireEvent.click(
      within(firstCafeList()).getByRole("link", { name: "Make Pitch yours" })
    )
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.pitch)
    })
    await goHome()
    await expectHomeStarted()

    fireEvent.click(
      within(firstCafeList()).getByRole("link", {
        name: "Triage one Apply card",
      })
    )
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.apply)
    })
    await goHome()
    await expectHomeStarted()

    const list = firstCafeList()
    expect(
      within(list).getByRole("link", { name: "Open the sample CV, done" })
    ).toBeInTheDocument()
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
    expect(readFirstCafeState("user_test").completed).toEqual(["sample-cv"])
    expect(
      screen.queryByRole("region", { name: "You're set" })
    ).not.toBeInTheDocument()
    expect(firstCafeNudge()).toBeInTheDocument()
  })

  it("marks Pitch and Apply only after an edit and a triage", async () => {
    const { router } = renderApp()
    await expectHomeStarted()
    fireEvent.click(screen.getByRole("button", { name: "I'm not sure yet" }))

    fireEvent.click(
      within(firstCafeList()).getByRole("link", { name: "Open the sample CV" })
    )
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.paper)
    })
    await goHome()
    await expectHomeStarted()

    fireEvent.click(
      within(firstCafeList()).getByRole("link", { name: "Make Pitch yours" })
    )
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.pitch)
    })
    expect(await screen.findByText("Pitch. Coming soon.")).toBeInTheDocument()
    await goHome()
    await expectHomeStarted()
    expect(
      within(firstCafeList()).queryByRole("link", {
        name: "Make Pitch yours, done",
      })
    ).not.toBeInTheDocument()
    expect(
      within(firstCafeList()).queryByRole("link", {
        name: "Triage one Apply card, done",
      })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "You're set" })
    ).not.toBeInTheDocument()

    fireEvent.click(
      within(firstCafeList()).getByRole("link", {
        name: "Triage one Apply card",
      })
    )
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.apply)
    })
    const panel = await screen.findByRole("complementary", {
      name: "Opportunity detail",
    })
    fireEvent.click(within(panel).getByRole("button", { name: "Move to Prep" }))
    await goHome()
    await expectHomeStarted()

    expect(
      screen.getByRole("heading", { name: "Four small things" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "You're set" })
    ).not.toBeInTheDocument()
    expect(readFirstCafeState("user_test").completed).toEqual([
      "sample-cv",
      "apply",
    ])
  })
})
