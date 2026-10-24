import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import {
  legacyStarterPitchDocument,
  type PitchDocument,
} from "@workspace/domain"
import {
  SAMPLE_AUTHOR,
  SAMPLE_AUTHOR_NAME,
} from "@/features/seed/sample-author.ts"
import {
  setMockSession,
  TEST_SESSION,
  TEST_SESSION_USER,
} from "@/test/auth-client-mock.ts"
import { getMockGithubUsername } from "@/features/pitch/pitch-github-mock.ts"
import { readFirstCafeState } from "@/features/home/first-cafe-checklist.ts"
import { BLOCK_LABELS } from "@/features/pitch/pitch-types.ts"
import {
  getMockPitchDoc,
  resetPitchApiMock,
  setMockPitchDoc,
} from "@/test/pitch-api-mock.ts"
import { renderPitch, loadedPitch } from "@/test/pitch-test-helpers.tsx"

afterEach(() => {
  cleanup()
  resetPitchApiMock()
  vi.unstubAllGlobals()
})

describe("Pitch workspace Proof and persistence", () => {
  it("opens the checkout Proof from Achievements and closes it", async () => {
    await loadedPitch()

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
    expect(
      screen.getByRole("heading", { level: 2, name: SAMPLE_AUTHOR_NAME })
    ).toBeInTheDocument()
  })

  it("opens the checkout Proof from a persisted dead-link achievement", async () => {
    const starter = legacyStarterPitchDocument()
    const [checkout, ...rest] = starter.achievements
    setMockPitchDoc({
      id: "55555555-5555-7555-8555-555555555555",
      kind: "pitch",
      content: {
        ...starter,
        achievements: [
          {
            id: checkout!.id,
            year: checkout!.year,
            title: checkout!.title,
            context: checkout!.context,
            description: checkout!.description,
            tag: checkout!.tag,
            link: "#",
            linkLabel: "Read case study",
          },
          ...rest,
        ],
      },
      contentVersion: 1,
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    })

    await loadedPitch()
    fireEvent.click(
      screen.getByRole("button", {
        name: "Open Proof: Product card resize study",
      })
    )
    expect(
      screen.getByRole("dialog", { name: "Product card resize study" })
    ).toBeInTheDocument()
  })

  it("does not present showcase or contact rows as links that go nowhere", async () => {
    await loadedPitch()
    const github = getMockGithubUsername(SAMPLE_AUTHOR_NAME)

    expect(screen.getByText("Open Proof")).toBeInTheDocument()
    expect(screen.getByText("Proof chain")).toBeInTheDocument()
    expect(screen.queryByText("Read case study")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Case study · Proof chain")
    ).not.toBeInTheDocument()
    expect(screen.getAllByText(`@${github}`).length).toBeGreaterThan(0)
    expect(screen.getByText(SAMPLE_AUTHOR.email)).toBeInTheDocument()
    expect(screen.getByText("LinkedIn")).toBeInTheDocument()

    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /read case study/i })
    ).not.toBeInTheDocument()
    expect(document.querySelector("a[href]")).toBeNull()
    expect(screen.getAllByRole("button", { name: /open proof/i })).toHaveLength(
      1
    )
  })

  it("does not show Copied when the clipboard write fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("blocked"))
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    })

    await loadedPitch()
    fireEvent.click(screen.getByRole("button", { name: "Edit Pitch" }))
    fireEvent.click(screen.getByRole("button", { name: "Publish" }))
    fireEvent.click(await screen.findByRole("button", { name: "Preview" }))
    fireEvent.click(await screen.findByRole("button", { name: "Copy link" }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled()
    })
    expect(
      screen.getByRole("button", { name: "Copy link" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Copied" })
    ).not.toBeInTheDocument()
  })

  it("persists hide and about edits through the Command door", async () => {
    await loadedPitch()

    fireEvent.click(screen.getByRole("button", { name: "Edit Pitch" }))
    const about = screen
      .getByRole("heading", { name: "About" })
      .closest("section")
    fireEvent.click(
      within(about as HTMLElement).getByRole("button", { name: "Hide" })
    )
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "About" })
      ).not.toBeInTheDocument()
    })
    expect(readFirstCafeState(TEST_SESSION_USER.id).completed).toEqual([
      "pitch",
    ])

    cleanup()
    await loadedPitch()
    expect(
      screen.queryByRole("heading", { name: "About" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Achievements" })
    ).toBeInTheDocument()
  })

  it("heals leftover persona copy without emptying Moments arrays", async () => {
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
      id: "55555555-5555-7555-8555-555555555558",
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
    expect(
      screen.getByRole("button", { name: "Checkout highlight" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Checkout story" })
    ).toHaveTextContent("Checkout")
    expect(screen.queryByText(/Alex Tran/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sacred space/i)).not.toBeInTheDocument()

    await waitFor(() => {
      const stored = getMockPitchDoc()?.content as PitchDocument
      expect(stored.storyHighlights.length).toBe(starter.storyHighlights.length)
      expect(stored.bento.length).toBe(starter.bento.length)
      expect(stored.bento.find((card) => card.id === "b4")).toMatchObject({
        title: "Checkout",
        body: "Hallway test setup",
      })
      expect(JSON.stringify(stored)).not.toMatch(/Alex Tran/i)
      expect(JSON.stringify(stored)).not.toMatch(/sacred space/i)
    })
  })

  it("restores wiped Moments so chips and the unhidden card match Checkout", async () => {
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
      id: "55555555-5555-7555-8555-555555555559",
      kind: "pitch",
      content: {
        ...starter,
        status: "QVE134-persist-marker-1532",
        storyHighlights: [],
        bento: [],
        blocks: starter.blocks.map((block) =>
          block.kind === "moments" ? { ...block, hidden: true } : block
        ),
      },
      contentVersion: 1,
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    })

    renderPitch()
    expect(
      await screen.findByRole("heading", { level: 2, name: "Scout Tester" })
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("button", { name: "Checkout highlight" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Moments" })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Alex Tran/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sacred space/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Edit Pitch" }))
    fireEvent.click(screen.getByRole("button", { name: "Add section" }))
    fireEvent.click(screen.getByRole("button", { name: BLOCK_LABELS.moments }))
    expect(
      await screen.findByRole("heading", { name: "Moments" })
    ).toBeInTheDocument()

    const momentsCard = screen.getByRole("button", { name: "Checkout story" })
    expect(momentsCard).toHaveTextContent("Checkout")
    expect(momentsCard).toHaveTextContent("Hallway test setup")
    fireEvent.click(momentsCard)
    const viewer = screen.getByRole("dialog", { name: "Work story viewer" })
    expect(within(viewer).getByText("Checkout")).toBeInTheDocument()
    expect(within(viewer).getByText("Hallway test setup")).toBeInTheDocument()
    expect(within(viewer).queryByText(/Alex Tran/i)).not.toBeInTheDocument()

    await waitFor(() => {
      const stored = getMockPitchDoc()?.content as PitchDocument
      expect(stored.storyHighlights.length).toBeGreaterThan(0)
      expect(stored.bento.length).toBeGreaterThan(0)
    })
  })

  it("keeps storyHighlights and bento when Moments is hidden", async () => {
    await loadedPitch()
    const before = getMockPitchDoc()?.content as PitchDocument
    expect(before.storyHighlights.length).toBeGreaterThan(0)
    expect(before.bento.length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole("button", { name: "Edit Pitch" }))
    const moments = screen
      .getByRole("heading", { name: "Moments" })
      .closest("section")
    expect(moments).not.toBeNull()
    fireEvent.click(
      within(moments as HTMLElement).getByRole("button", { name: "Hide" })
    )
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Moments" })
      ).not.toBeInTheDocument()
    })

    expect(
      screen.getByRole("button", { name: "Checkout highlight" })
    ).toBeInTheDocument()
    const stored = getMockPitchDoc()?.content as PitchDocument
    expect(stored.storyHighlights).toEqual(before.storyHighlights)
    expect(stored.bento.length).toBe(before.bento.length)
    expect(
      stored.blocks.find((block) => block.kind === "moments")?.hidden
    ).toBe(true)
  })
})
