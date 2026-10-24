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
import { BROAD_SUGGESTIONS } from "@/features/home/suggestions.ts"
import { renderApp } from "@/test/render-app.tsx"
import { expectHomeIdle } from "@/test/home-helpers.ts"

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

    const chip = BROAD_SUGGESTIONS[0]!
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

  it("puts the composer before the getting-started cards and keeps them closed", async () => {
    renderApp()
    await expectHomeIdle()

    expect(
      screen.queryByRole("heading", { name: "What are you aiming for?" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Four small things" })
    ).not.toBeInTheDocument()

    const composer = screen.getByRole("textbox", { name: "Message Coach" })
    const toggle = screen.getByRole("button", { name: "Get started" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(
      composer.compareDocumentPosition(toggle) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(
      screen.getByRole("heading", { name: "What are you aiming for?" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Four small things" })
    ).toBeInTheDocument()
  })

  it("asks with one placeholder, Ask the Coach", async () => {
    renderApp()
    await expectHomeIdle()

    expect(screen.getByPlaceholderText("Ask the Coach")).toBe(
      screen.getByRole("textbox", { name: "Message Coach" })
    )
  })

  it("offers four broad chips and keeps niche prompts behind More ideas", async () => {
    renderApp()
    await expectHomeIdle()

    for (const label of [
      "Review my CV",
      "Draft a Letter",
      "Triage Apply",
      "Start a Proof",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
    expect(
      screen.queryByRole("button", { name: "Prep interview" })
    ).not.toBeInTheDocument()

    const more = screen.getByRole("button", { name: "More ideas" })
    expect(more).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(more)

    expect(more).toHaveAttribute("aria-expanded", "true")
    fireEvent.click(screen.getByRole("button", { name: "Prep interview" }))
    expect(
      (
        screen.getByRole("textbox", {
          name: "Message Coach",
        }) as HTMLTextAreaElement
      ).value
    ).toContain("interview")
    expect(
      screen.queryByRole("button", { name: /follow.?up email/i })
    ).not.toBeInTheDocument()
  })

  it("shows the same keyboard focus ring on the composer as the other controls", async () => {
    renderApp()
    await expectHomeIdle()

    const composer = screen.getByRole("textbox", { name: "Message Coach" })
    composer.focus()
    expect(composer).toHaveFocus()

    const frame = composer.closest("[data-slot='coach-composer']")
    expect(frame).not.toBeNull()
    expect(frame).toHaveClass(
      "has-focus-visible:ring-3",
      "has-focus-visible:ring-ring/50",
      "has-focus-visible:border-ring"
    )
  })
})
