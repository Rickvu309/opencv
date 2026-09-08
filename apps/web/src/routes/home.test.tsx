import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { SURFACE_COPY, SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { SUGGESTION_POOLS } from "@/features/home/suggestions.ts"
import { renderApp } from "@/test/render-app.tsx"

async function expectHomeIdle() {
  expect(
    await screen.findByRole("heading", {
      level: 1,
      name: new RegExp(
        `^Good (morning|afternoon|evening), ${SAMPLE_AUTHOR_NAME}$`
      ),
    })
  ).toBeInTheDocument()
  expect(
    screen.getByRole("textbox", { name: "Message Coach" })
  ).toBeInTheDocument()
}

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Home idle", () => {
  it("greets the placeholder User by time of day", async () => {
    renderApp()
    await expectHomeIdle()
    expect(screen.queryByText(/Eric/i)).not.toBeInTheDocument()
  })

  it("fills the composer when a suggestion chip is tapped", async () => {
    renderApp()
    await expectHomeIdle()

    const chip = SUGGESTION_POOLS[0]![0]!
    fireEvent.click(screen.getByRole("button", { name: chip.label }))

    expect(screen.getByRole("textbox", { name: "Message Coach" })).toHaveValue(
      chip.prompt
    )
  })

  it("sends on Enter and inserts a newline on Shift+Enter", async () => {
    renderApp()
    await expectHomeIdle()

    const composer = screen.getByRole("textbox", { name: "Message Coach" })
    fireEvent.change(composer, { target: { value: "Help me plan the week" } })

    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true })
    expect(composer).toHaveValue("Help me plan the week")

    fireEvent.keyDown(composer, { key: "Enter", shiftKey: false })
    expect(screen.getByRole("textbox", { name: "Message Coach" })).toHaveValue(
      ""
    )
    expect(
      screen.getByRole("status", { name: "Coach is working" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", {
        level: 1,
        name: new RegExp(
          `^Good (morning|afternoon|evening), ${SAMPLE_AUTHOR_NAME}$`
        ),
      })
    ).not.toBeInTheDocument()
    expect(
      await screen.findByRole("log", { name: "Thread" })
    ).toHaveTextContent("Help me plan the week")
    await waitFor(() => {
      expect(
        screen.queryByRole("status", { name: "Coach is working" })
      ).not.toBeInTheDocument()
    })
  })

  it("opens stub attach and upload items from the + menu", async () => {
    renderApp()
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    const menu = await screen.findByRole("menu")
    expect(
      within(menu).getByRole("menuitem", { name: /upload a file/i })
    ).toBeInTheDocument()
    expect(
      within(menu).getByRole("menuitem", { name: /recent/i })
    ).toBeInTheDocument()
    expect(
      within(menu).getByRole("menuitem", { name: "Attach from Paper" })
    ).toBeInTheDocument()
    expect(
      within(menu).getByRole("menuitem", { name: "Add connector" })
    ).toBeInTheDocument()
    expect(
      within(menu).queryByRole("menuitem", { name: /project/i })
    ).not.toBeInTheDocument()
  })

  it("routes Attach from Paper to the Paper drive", async () => {
    const { router } = renderApp()
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Attach from Paper" })
    )
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.paper)
    })
  })

  it("disables coming-soon composer affordances", async () => {
    renderApp()
    await expectHomeIdle()

    const mic = screen.getByRole("button", {
      name: "Voice input — coming soon",
    })
    expect(mic).toBeDisabled()
    expect(mic).toHaveAttribute("aria-disabled", "true")

    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    const menu = await screen.findByRole("menu")

    const upload = within(menu).getByRole("menuitem", {
      name: /upload a file/i,
    })
    const recent = within(menu).getByRole("menuitem", { name: /^recent/i })
    expect(upload).toHaveAttribute("aria-disabled", "true")
    expect(recent).toHaveAttribute("aria-disabled", "true")
    expect(upload).toHaveTextContent("Coming soon")
    expect(recent).toHaveTextContent("Coming soon")

    expect(
      within(menu).getByRole("menuitem", { name: "Attach from Paper" })
    ).not.toHaveAttribute("aria-disabled", "true")
    expect(
      within(menu).getByRole("menuitem", { name: "Add connector" })
    ).not.toHaveAttribute("aria-disabled", "true")
  })

  it("opens Settings on the Connected apps tab from the connect row", async () => {
    const { router } = renderApp()
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("link", { name: "Connect apps" }))

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: SURFACE_COPY.settings.title,
      })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.settings)
      expect(router.state.location.search).toMatchObject({ tab: "apps" })
    })
    expect(screen.getByRole("tab", { name: "Connected apps" })).toHaveAttribute(
      "data-active"
    )
    expect(screen.getByRole("heading", { name: "Gmail" })).toBeInTheDocument()
  })
})

describe("Home first-café checklist", () => {
  it("shows at most four dismissible first moves with real deep-links", async () => {
    renderApp()
    await expectHomeIdle()

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
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("button", { name: "Hide this" }))
    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await screen.findByRole("region", { name: "Paper" })
    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()

    expect(
      screen.queryByRole("heading", { name: "Four small things" })
    ).not.toBeInTheDocument()
  })

  it("auto-completes an item after the User visits the linked surface", async () => {
    const { router } = renderApp()
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("link", { name: "Open the sample CV" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.paper)
      expect(router.state.location.search).toMatchObject({ open: "sample" })
    })

    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()

    expect(
      screen.getByRole("link", { name: "Open the sample CV, done" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Make Pitch yours" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Triage one Apply card" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Connect email, optional" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Triage one Apply card, done" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /next step|continue/i })
    ).not.toBeInTheDocument()
  })

  it("completes Apply only after a real visit to /app/apply", async () => {
    const { router } = renderApp()
    await expectHomeIdle()

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

    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()

    expect(
      screen.getByRole("link", { name: "Triage one Apply card, done" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Open the sample CV" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Make Pitch yours" })
    ).toBeInTheDocument()
  })

  it("opens one seeded Apply card with a Prep next action and keeps the board", async () => {
    const { router } = renderApp()
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("link", { name: "Triage one Apply card" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.apply)
      expect(router.state.location.search).toMatchObject({ open: "guide" })
    })

    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(
      within(panel).getByDisplayValue("Associate PM intern")
    ).toBeInTheDocument()
    expect(
      within(panel).getByRole("button", { name: "Move to Prep" })
    ).toBeInTheDocument()
    expect(
      within(panel).getByRole("combobox", { name: "Next step" })
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
        await screen.findByRole("complementary", { name: "Job detail" })
      ).getByRole("combobox", { name: "Next step" })
    ).toHaveTextContent("Follow-up")
  })
})
