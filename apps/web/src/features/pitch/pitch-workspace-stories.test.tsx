import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { legacyStarterPitchDocument } from "@workspace/domain"
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import {
  setMockSession,
  TEST_SESSION,
  TEST_SESSION_USER,
} from "@/test/auth-client-mock.ts"
import { pitchHandle, publicPitchHref } from "@/features/pitch/pitch-types.ts"
import {
  getMockPitchDoc,
  resetPitchApiMock,
  setMockPitchDoc,
} from "@/test/pitch-api-mock.ts"
import {
  renderPitch,
  clickClearDemo,
  expectSampleMomentsGone,
  loadedPitch,
} from "@/test/pitch-test-helpers.tsx"

afterEach(() => {
  cleanup()
  resetPitchApiMock()
  vi.unstubAllGlobals()
})

describe("Pitch workspace stories and edits", () => {
  it("opens and closes a story highlight without leaving the page", async () => {
    await loadedPitch()

    fireEvent.click(screen.getByRole("button", { name: "Checkout highlight" }))
    const viewer = screen.getByRole("dialog", { name: "Work story viewer" })
    expect(viewer).toBeInTheDocument()
    expect(within(viewer).getByText("Checkout")).toBeInTheDocument()
    expect(within(viewer).getByText("Hallway test setup")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(
      screen.queryByRole("dialog", { name: "Work story viewer" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: SAMPLE_AUTHOR_NAME })
    ).toBeInTheDocument()
  })

  it("opens a story whose title matches each visible highlight chip", async () => {
    await loadedPitch()
    const highlights = legacyStarterPitchDocument().storyHighlights
    expect(highlights.length).toBeGreaterThan(0)

    for (const highlight of highlights) {
      fireEvent.click(
        screen.getByRole("button", { name: `${highlight.label} highlight` })
      )
      const viewer = screen.getByRole("dialog", { name: "Work story viewer" })
      expect(within(viewer).getByText(highlight.label)).toBeInTheDocument()
      expect(
        within(viewer).getByText(highlight.slides[0]!.caption)
      ).toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: "Close" }))
      expect(
        screen.queryByRole("dialog", { name: "Work story viewer" })
      ).not.toBeInTheDocument()
    }

    expect(screen.queryByText(/sacred space/i)).not.toBeInTheDocument()
  })

  it("opens the Checkout reel from the Moments story card, not a sacred-space label", async () => {
    await loadedPitch()

    fireEvent.click(screen.getByRole("button", { name: "Checkout story" }))
    const viewer = screen.getByRole("dialog", { name: "Work story viewer" })
    expect(within(viewer).getByText("Checkout")).toBeInTheDocument()
    expect(within(viewer).getByText("Hallway test setup")).toBeInTheDocument()
    expect(within(viewer).queryByText(/sacred space/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /sacred space/i })
    ).not.toBeInTheDocument()
  })

  it("repairs a persisted sacred-space chip so it opens Checkout", async () => {
    const starter = legacyStarterPitchDocument()
    setMockPitchDoc({
      id: "55555555-5555-7555-8555-555555555556",
      kind: "pitch",
      content: {
        ...starter,
        bento: starter.bento.map((card) =>
          card.storyHighlightId === "sh-checkout"
            ? {
                ...card,
                title: "my sacred space",
                body: "Hallway test · late night Figma",
              }
            : card
        ),
      },
      contentVersion: 1,
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    })

    await loadedPitch()
    expect(
      screen.queryByRole("button", { name: /sacred space/i })
    ).not.toBeInTheDocument()
    const momentsCard = screen.getByRole("button", { name: "Checkout story" })
    expect(momentsCard).toHaveTextContent("Checkout")
    expect(momentsCard).toHaveTextContent("Hallway test setup")
    fireEvent.click(momentsCard)
    const viewer = screen.getByRole("dialog", { name: "Work story viewer" })
    expect(within(viewer).getByText("Checkout")).toBeInTheDocument()
    expect(within(viewer).getByText("Hallway test setup")).toBeInTheDocument()
  })

  it("shows the session User on Moments and the viewer, not leftover Alex Tran", async () => {
    setMockSession({
      user: {
        ...TEST_SESSION_USER,
        name: "Scout Tester",
        email: "scout@example.com",
      },
      session: TEST_SESSION,
    })
    const starter = legacyStarterPitchDocument()
    setMockPitchDoc({
      id: "55555555-5555-7555-8555-555555555557",
      kind: "pitch",
      content: {
        ...starter,
        github: { username: "alex-tran-uit", connected: true },
        bento: starter.bento.map((card) => {
          if (card.id === "b1") return { ...card, title: "Alex Tran" }
          if (card.storyHighlightId === "sh-checkout") {
            return {
              ...card,
              title: "my sacred space",
              body: "Hallway test · late night Figma",
              storyHighlightId: undefined,
            }
          }
          if (card.id === "b5") return { ...card, title: "@alex-tran-uit" }
          return card
        }),
      },
      contentVersion: 1,
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    })

    renderPitch()
    expect(
      await screen.findByRole("heading", { level: 2, name: "Scout Tester" })
    ).toBeInTheDocument()
    expect(screen.queryByText(/Alex Tran/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/alex-tran/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sacred space/i)).not.toBeInTheDocument()

    const momentsCard = screen.getByRole("button", { name: "Checkout story" })
    expect(momentsCard).toHaveTextContent("Checkout")
    expect(momentsCard).toHaveTextContent("Hallway test setup")
    fireEvent.click(momentsCard)
    const viewer = screen.getByRole("dialog", { name: "Work story viewer" })
    expect(within(viewer).getByText("Scout Tester")).toBeInTheDocument()
    expect(within(viewer).getByText("Checkout")).toBeInTheDocument()
    expect(within(viewer).queryByText(/Alex Tran/i)).not.toBeInTheDocument()
  })

  it("only claims Copy link succeeded when the clipboard write works", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    })

    await loadedPitch()
    fireEvent.click(screen.getByRole("button", { name: "Edit Pitch" }))
    fireEvent.click(screen.getByRole("button", { name: "Publish" }))
    fireEvent.click(await screen.findByRole("button", { name: "Preview" }))
    fireEvent.click(await screen.findByRole("button", { name: "Copy link" }))

    expect(
      await screen.findByRole("button", { name: "Copied" })
    ).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(
      publicPitchHref(pitchHandle(SAMPLE_AUTHOR_NAME))
    )
  })

  it("does not claim Copy link succeeded when the public URL is not live", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    })

    const starter = legacyStarterPitchDocument()
    setMockPitchDoc({
      id: "55555555-5555-7555-8555-555555555561",
      kind: "pitch",
      content: { ...starter, published: true },
      contentVersion: 1,
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    })

    await loadedPitch()
    expect(screen.getByRole("button", { name: "Copy link" })).toBeEnabled()

    setMockPitchDoc({
      ...getMockPitchDoc()!,
      content: { ...starter, published: false },
    })

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }))

    await waitFor(() => {
      expect(writeText).not.toHaveBeenCalled()
    })
    expect(
      screen.getByRole("button", { name: "Copy link" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Copied" })
    ).not.toBeInTheDocument()
  })

  it("adds a starter ACHIEVEMENT on an empty Pitch so Open Proof is smokeable", async () => {
    await loadedPitch()
    clickClearDemo()
    expect(await screen.findByText("Your Pitch is empty")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Start your Pitch" }))
    expect(screen.getByText("Editing Pitch")).toBeInTheDocument()
    expect(
      screen.getByText(
        /Add a Proof you can open — a checkout hallway study is ready/
      )
    ).toBeInTheDocument()

    const addAchievement = screen.getByRole("button", {
      name: /add achievement/i,
    })
    expect(addAchievement).toBeEnabled()
    expect(addAchievement).not.toHaveTextContent("Coming soon")
    fireEvent.click(addAchievement)

    await waitFor(() => {
      expect(screen.getByText("Checkout card resize study")).toBeInTheDocument()
    })
    expect(screen.getByText("Open Proof")).toBeInTheDocument()
    expect(screen.queryByText("Read case study")).not.toBeInTheDocument()
    expect(document.querySelector("a[href='#']")).toBeNull()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open Proof: Product card resize study",
      })
    )
    const viewer = screen.getByRole("dialog", {
      name: "Product card resize study",
    })
    expect(viewer).toBeInTheDocument()
    expect(
      within(viewer).getByText("E-commerce checkout · Side project")
    ).toBeInTheDocument()
    expect(within(viewer).getByText("What I did")).toBeInTheDocument()
    expect(
      within(viewer).getByText(/12-person hallway test/i)
    ).toBeInTheDocument()

    fireEvent.click(within(viewer).getByRole("button", { name: "Close" }))
    expect(
      screen.queryByRole("dialog", { name: "Product card resize study" })
    ).not.toBeInTheDocument()

    const addAgain = screen.getByRole("button", { name: /add achievement/i })
    expect(addAgain).toBeDisabled()
    expect(addAgain).toHaveTextContent("Coming soon")
    expect(getMockPitchDoc()?.content).toMatchObject({
      demo: false,
      headline: "Proof on this page — replace with your story",
      achievements: [
        expect.objectContaining({
          title: "Checkout card resize study",
          proofId: "checkout",
        }),
      ],
    })
    expectSampleMomentsGone()
  })
})
