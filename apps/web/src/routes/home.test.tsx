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
import { AIM_OPTIONS } from "@/features/home/aim-prompt.ts"
import { SUGGESTION_POOLS } from "@/features/home/suggestions.ts"
import { STARTER_PITCH_HEADLINE, starterPitchDocument } from "@workspace/domain"
import { writeAimPromptState } from "@/features/home/aim-prompt.ts"
import {
  readFirstCafeState,
  writeFirstCafeState,
} from "@/features/home/first-cafe-checklist.ts"
import { getMockPitchDoc, setMockPitchDoc } from "@/test/pitch-api-mock.ts"
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

function firstCafeList() {
  return screen.getByRole("region", { name: "Four small things" })
}

function firstCafeNudge() {
  return screen.getByRole("region", { name: "One next thing" })
}

function firstCafeQuietDone() {
  return screen.getByRole("region", { name: "You're set" })
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
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("button", { name: "Hide this" }))
    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await screen.findByRole("region", { name: "Paper" })
    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()

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
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("link", { name: "Open the sample CV" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.paper)
      expect(router.state.location.search).toMatchObject({ open: "sample" })
    })

    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()

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

    const list = firstCafeList()
    expect(
      within(list).getByRole("link", { name: "Triage one Apply card, done" })
    ).toBeInTheDocument()
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
    expect(readFirstCafeState("user_test").completed).toEqual(["apply"])
  })

  it("does not complete Sample or Pitch when sibling nav preloads on Apply", async () => {
    const { router } = renderApp()
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("link", { name: "Triage one Apply card" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.apply)
    })
    expect(
      await screen.findByRole("heading", { level: 1, name: "Apply" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Paper" })).not.toBeInTheDocument()

    fireEvent.mouseEnter(screen.getByRole("link", { name: "Paper" }))
    fireEvent.focus(screen.getByRole("link", { name: "Paper" }))
    fireEvent.mouseEnter(screen.getByRole("link", { name: "Pitch" }))
    fireEvent.focus(screen.getByRole("link", { name: "Pitch" }))

    expect(router.state.location.pathname).toBe(SURFACE_PATHS.apply)
    expect(
      screen.getByRole("heading", { level: 1, name: "Apply" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Paper" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()

    const list = firstCafeList()
    expect(
      within(list).getByRole("link", { name: "Triage one Apply card, done" })
    ).toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Open the sample CV, done" })
    ).not.toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Make Pitch yours, done" })
    ).not.toBeInTheDocument()
    expect(readFirstCafeState("user_test").completed).toEqual(["apply"])
  })

  it("completes Pitch only after a real visit to /app/pitch", async () => {
    const { router } = renderApp()
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("link", { name: "Make Pitch yours" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.pitch)
    })

    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()

    const list = firstCafeList()
    expect(
      within(list).getByRole("link", { name: "Make Pitch yours, done" })
    ).toBeInTheDocument()
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

describe("Home first-café next nudge", () => {
  it("shows one Pitch nudge after the sample CV win and stays skippable", async () => {
    const { router } = renderApp()
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("link", { name: "Open the sample CV" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.paper)
    })

    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()

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
    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()

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

  it("after Apply only, nudges the sample CV without checking Sample or Pitch", async () => {
    const { router } = renderApp()
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("link", { name: "Triage one Apply card" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.apply)
    })

    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()

    const nudge = firstCafeNudge()
    expect(
      within(nudge).getByRole("link", { name: "Open the sample CV" })
    ).toHaveAttribute("href", `${SURFACE_PATHS.paper}?open=sample`)
    expect(within(nudge).getAllByRole("link")).toHaveLength(1)

    const list = firstCafeList()
    expect(
      within(list).getByRole("link", { name: "Triage one Apply card, done" })
    ).toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Open the sample CV, done" })
    ).not.toBeInTheDocument()
    expect(
      within(list).queryByRole("link", { name: "Make Pitch yours, done" })
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
    await expectHomeIdle()

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
    await expectHomeIdle()

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
    await expectHomeIdle()

    fireEvent.click(within(firstCafeQuietDone()).getByRole("button", { name: "Hide" }))
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
    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()

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
    await expectHomeIdle()

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

describe("Home optional aim prompt", () => {
  it("asks once on idle Home and Skip always dismisses it", async () => {
    const { router } = renderApp()
    await expectHomeIdle()

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
    expect(router.state.location.pathname).toBe(SURFACE_PATHS.home)

    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    expect(
      screen.queryByRole("heading", { name: "What are you aiming for?" })
    ).not.toBeInTheDocument()
    expect(getMockPitchDoc()?.content).toMatchObject({
      headline: STARTER_PITCH_HEADLINE,
    })

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
    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()

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
    await expectHomeIdle()

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
    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()

    expect(
      screen.queryByRole("region", { name: "One next thing" })
    ).not.toBeInTheDocument()
    expect(firstCafeList()).toBeInTheDocument()
  })

  it("after Skip aim then Apply only, does not check Sample or Pitch", async () => {
    const { router } = renderApp()
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    expect(firstCafeNudge()).toBeInTheDocument()
    expect(readFirstCafeState("user_test").completed).toEqual([])

    fireEvent.click(screen.getByRole("link", { name: "Triage one Apply card" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.apply)
    })

    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()

    expect(readFirstCafeState("user_test").completed).toEqual(["apply"])
    const list = firstCafeList()
    expect(
      within(list).getByRole("link", { name: "Triage one Apply card, done" })
    ).toBeInTheDocument()
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

  it("lets I'm not sure yet skip without touching Pitch", async () => {
    renderApp()
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("button", { name: "I'm not sure yet" }))
    expect(
      screen.queryByRole("heading", { name: "What are you aiming for?" })
    ).not.toBeInTheDocument()
    expect(getMockPitchDoc()?.content).toMatchObject({
      headline: STARTER_PITCH_HEADLINE,
    })
    expect(
      within(firstCafeNudge()).getByRole("link", { name: "Open the sample CV" })
    ).toBeInTheDocument()
    expect(readFirstCafeState("user_test").completed).toEqual([])
  })

  it("soft-feeds Pitch headline from one aim without forcing a custom line", async () => {
    const { router } = renderApp()
    await expectHomeIdle()

    fireEvent.click(
      screen.getByRole("button", { name: "A product intern role" })
    )
    expect(
      screen.queryByRole("heading", { name: "What are you aiming for?" })
    ).not.toBeInTheDocument()
    expect(
      within(firstCafeNudge()).getByRole("link", { name: "Open the sample CV" })
    ).toBeInTheDocument()
    expect(readFirstCafeState("user_test").completed).toEqual([])

    await waitFor(() => {
      expect(getMockPitchDoc()?.content).toMatchObject({
        headline: "Aiming for a product intern role",
      })
    })

    fireEvent.click(screen.getByRole("link", { name: "Pitch" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.pitch)
    })
    expect(
      await screen.findByText("Aiming for a product intern role")
    ).toBeInTheDocument()
    expect(screen.queryByText(STARTER_PITCH_HEADLINE)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: /step \d|goal|school/i })
    ).not.toBeInTheDocument()
  })

  it("does not overwrite a Pitch headline the User already wrote", async () => {
    const current = getMockPitchDoc()
    if (!current) throw new Error("expected starter Pitch")
    setMockPitchDoc({
      ...current,
      content: {
        ...starterPitchDocument(),
        headline: "Design intern · night shift",
        demo: false,
      },
    })

    renderApp()
    await expectHomeIdle()

    fireEvent.click(
      screen.getByRole("button", { name: "A first full-time job" })
    )
    expect(
      screen.queryByRole("heading", { name: "What are you aiming for?" })
    ).not.toBeInTheDocument()

    await waitFor(() => {
      expect(getMockPitchDoc()?.content).toMatchObject({
        headline: "Design intern · night shift",
      })
    })
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
