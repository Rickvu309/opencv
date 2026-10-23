import { createElement, type ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import {
  emptyPitchDocument,
  STARTER_PITCH_ABOUT_LEAD,
  STARTER_PITCH_HEADLINE,
  starterPitchDocument,
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
import { SURFACE_COPY } from "@/features/app-shell/surfaces.ts"
import { getMockGithubUsername } from "@/features/pitch/pitch-github-mock.ts"
import { readFirstCafeState } from "@/features/home/first-cafe-checklist.ts"
import { PitchWorkspace } from "@/features/pitch/pitch-workspace.tsx"
import {
  BLOCK_LABELS,
  pitchHandle,
  publicPitchHref,
} from "@/features/pitch/pitch-types.ts"
import { createQueryClient } from "@/lib/query-client.ts"
import {
  getMockPitchDoc,
  pitchApiFetch,
  resetPitchApiMock,
  setMockPitchDoc,
} from "@/test/pitch-api-mock.ts"

function installPitchFetch() {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await pitchApiFetch(input, init)
    if (res) return res
    throw new Error(`unexpected fetch: ${String(input)}`)
  })
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: createQueryClient() },
    children
  )
}

function renderPitch() {
  installPitchFetch()
  return render(createElement(PitchWorkspace), { wrapper })
}

function clearDemoButtons() {
  return screen.getAllByRole("button", { name: "Clear demo" })
}

function clickClearDemo() {
  fireEvent.click(clearDemoButtons()[0]!)
}

function expectSampleMomentsGone() {
  expect(screen.queryByText(/Sample · campus club/i)).not.toBeInTheDocument()
  expect(screen.queryByText("+18%")).not.toBeInTheDocument()
  expect(screen.queryByText(/add-to-cart lift/i)).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "Checkout highlight" })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "Club sprint highlight" })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "Wallet audit highlight" })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByText("Tap a highlight to watch work moments · like Instagram Stories")
  ).not.toBeInTheDocument()
}

async function loadedPitch() {
  renderPitch()
  expect(
    await screen.findByRole("heading", { level: 1, name: SAMPLE_AUTHOR_NAME })
  ).toBeInTheDocument()
}

afterEach(() => {
  cleanup()
  resetPitchApiMock()
  vi.unstubAllGlobals()
})

describe("Pitch workspace", () => {
  it("renders the session User portfolio with mock GitHub activity", async () => {
    await loadedPitch()
    const starter = starterPitchDocument()
    const github = getMockGithubUsername(SAMPLE_AUTHOR_NAME)

    expect(screen.getByText(starter.headline)).toBeInTheDocument()
    expect(starter.headline).toBe(STARTER_PITCH_HEADLINE)
    expect(screen.getByText("Demo content")).toBeInTheDocument()
    expect(
      screen.getByText("This page is a sample, not your story.")
    ).toBeInTheDocument()
    expect(clearDemoButtons().length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText("Editing Pitch")).not.toBeInTheDocument()
    expect(screen.queryByText(/Aspiring product manager/i)).not.toBeInTheDocument()
    expect(
      screen.getByText(`opencv.me/u/${pitchHandle(SAMPLE_AUTHOR_NAME)}`)
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Moments" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Achievements" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Experience" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Work & documents" })
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "GitHub" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument()
    expect(screen.getAllByText(`@${github}`).length).toBeGreaterThan(0)
    expect(screen.getByText("Connected · mock integration")).toBeInTheDocument()
    expect(screen.getAllByTitle(/contribution/i).length).toBeGreaterThan(50)
    expect(
      screen.getByRole("button", { name: "Checkout highlight" })
    ).toBeInTheDocument()
    expect(screen.queryByText(/Eric Nguyen/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/eric-nguyen/i)).not.toBeInTheDocument()
    expect(screen.queryByText(SURFACE_COPY.pitch.body)).not.toBeInTheDocument()
    expect(readFirstCafeState(TEST_SESSION_USER.id).completed).toEqual([])
  })

  it("keeps Clear demo on page chrome, not inside Edit menus", async () => {
    await loadedPitch()

    const chrome = screen.getAllByRole("banner")[0]
    expect(chrome).toBeTruthy()
    expect(
      within(chrome as HTMLElement).getByRole("button", { name: "Clear demo" })
    ).toBeInTheDocument()

    const demoBar = screen.getByRole("status")
    expect(within(demoBar).getByText("Demo content")).toBeInTheDocument()
    expect(within(demoBar).getByRole("button", { name: "Clear demo" })).toBeInTheDocument()
    expect(demoBar.closest(".overflow-auto")).toBeNull()
    expect(screen.queryByText("Editing Pitch")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("dialog", { name: /clear|wipe|reset|confirm/i })
    ).not.toBeInTheDocument()
  })

  it("still offers Clear demo when sample About is present without the demo flag", async () => {
    const starter = starterPitchDocument()
    const { demo, ...rest } = starter
    expect(demo).toBe(true)
    setMockPitchDoc({
      id: "55555555-5555-7555-8555-555555555560",
      kind: "pitch",
      content: rest,
      contentVersion: 1,
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    })

    await loadedPitch()
    expect(screen.getByText(STARTER_PITCH_ABOUT_LEAD)).toBeInTheDocument()
    expect(clearDemoButtons().length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Demo content")).toBeInTheDocument()
  })

  it("clears Demo content into an empty Pitch the User can make theirs", async () => {
    await loadedPitch()

    clickClearDemo()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(
      await screen.findByText("Your Pitch is empty")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Write a line about what you want next, or leave it quiet/
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Start your Pitch" })
    ).toBeInTheDocument()
    expect(screen.queryByText("Demo content")).not.toBeInTheDocument()
    expect(screen.queryByText(STARTER_PITCH_HEADLINE)).not.toBeInTheDocument()
    expect(screen.queryByText(/Aspiring product manager/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 1, name: SAMPLE_AUTHOR_NAME })
    ).toBeInTheDocument()
    expect(getMockPitchDoc()?.content).toEqual(emptyPitchDocument())
    expect(readFirstCafeState(TEST_SESSION_USER.id).wins).toEqual(["pitch"])
    expect(readFirstCafeState(TEST_SESSION_USER.id).completed).toEqual([])
    expectSampleMomentsGone()

    fireEvent.click(screen.getByRole("button", { name: "Start your Pitch" }))
    expect(screen.getByText("Editing Pitch")).toBeInTheDocument()
    expectSampleMomentsGone()
    expect(screen.queryByRole("heading", { name: "Moments" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "GitHub" })).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /add card/i })
    ).not.toBeInTheDocument()
  })

  it("does not resurrect sample Moments after Clear demo plus a real About line", async () => {
    await loadedPitch()
    clickClearDemo()
    expect(await screen.findByText("Your Pitch is empty")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Start your Pitch" }))
    fireEvent.click(screen.getByRole("button", { name: "Add section" }))
    fireEvent.click(screen.getByRole("button", { name: BLOCK_LABELS.about }))
    const about = screen.getByRole("heading", { name: "About" }).closest("section")
    expect(about).not.toBeNull()
    fireEvent.change(within(about as HTMLElement).getByRole("textbox"), {
      target: { value: "I ship small checkout studies." },
    })

    await waitFor(() => {
      const stored = getMockPitchDoc()?.content as PitchDocument
      expect(stored.about).toBe("I ship small checkout studies.")
      expect(stored.storyHighlights).toEqual([])
      expect(stored.bento).toEqual([])
    })
    expectSampleMomentsGone()
    expect(screen.queryByRole("heading", { name: "Moments" })).not.toBeInTheDocument()
    expect(screen.queryByText(/Demo content/i)).not.toBeInTheDocument()
    const addAchievement = screen.getByRole("button", {
      name: /add achievement/i,
    })
    expect(addAchievement).toBeEnabled()
    expect(addAchievement).not.toHaveTextContent("Coming soon")
  })

  it("does not resurrect highlight chips when demo:true leaked onto a real About", async () => {
    setMockPitchDoc({
      id: "55555555-5555-7555-8555-555555555562",
      kind: "pitch",
      content: {
        ...emptyPitchDocument(),
        demo: true,
      },
      contentVersion: 1,
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    })

    renderPitch()
    expect(await screen.findByText("Your Pitch is empty")).toBeInTheDocument()
    expectSampleMomentsGone()

    fireEvent.click(screen.getByRole("button", { name: "Start your Pitch" }))
    fireEvent.click(screen.getByRole("button", { name: "Add section" }))
    fireEvent.click(screen.getByRole("button", { name: BLOCK_LABELS.about }))
    const about = screen.getByRole("heading", { name: "About" }).closest("section")
    expect(about).not.toBeNull()
    fireEvent.change(within(about as HTMLElement).getByRole("textbox"), {
      target: { value: "I ship small checkout studies." },
    })

    await waitFor(() => {
      const stored = getMockPitchDoc()?.content as PitchDocument
      expect(stored.about).toBe("I ship small checkout studies.")
      expect(stored.storyHighlights).toEqual([])
      expect(stored.bento).toEqual([])
    })
    expectSampleMomentsGone()
    expect(screen.queryByRole("heading", { name: "Moments" })).not.toBeInTheDocument()
    const addAchievement = screen.getByRole("button", {
      name: /add achievement/i,
    })
    expect(addAchievement).toBeEnabled()
    expect(addAchievement).not.toHaveTextContent("Coming soon")
  })

  it("heals a cleared Pitch that still stored leftover sample Moments", async () => {
    const starter = starterPitchDocument()
    const { demo, ...rest } = starter
    expect(demo).toBe(true)
    setMockPitchDoc({
      id: "55555555-5555-7555-8555-555555555561",
      kind: "pitch",
      content: {
        ...rest,
        headline: "",
        status: "",
        about: "",
      },
      contentVersion: 1,
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    })

    await loadedPitch()
    expect(
      await screen.findByText("Your Pitch is empty")
    ).toBeInTheDocument()
    expectSampleMomentsGone()
    expect(screen.queryByText("Demo content")).not.toBeInTheDocument()
    await waitFor(() => {
      const stored = getMockPitchDoc()?.content as PitchDocument
      expect(stored.storyHighlights).toEqual([])
      expect(stored.bento).toEqual([])
    })
  })

  it("lets the User edit, hide, and restore showcase blocks", async () => {
    await loadedPitch()

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }))
    expect(screen.getByText("Editing Pitch")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /add achievement/i })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: /add achievement/i })
    ).toHaveTextContent("Coming soon")
    expect(
      screen.getByRole("button", { name: "New highlight — coming soon" })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: /add card/i })
    ).toBeDisabled()

    const about = screen.getByRole("heading", { name: "About" }).closest("section")
    expect(about).not.toBeNull()
    fireEvent.click(within(about as HTMLElement).getByRole("button", { name: "Hide" }))
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "About" })
      ).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Add section" }))
    fireEvent.click(screen.getByRole("button", { name: BLOCK_LABELS.about }))
    expect(await screen.findByRole("heading", { name: "About" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Add section" }))
    fireEvent.click(screen.getByRole("button", { name: BLOCK_LABELS.gallery }))
    expect(
      await screen.findByRole("heading", { name: "Gallery" })
    ).toBeInTheDocument()

    expect(screen.getByText(/unpublished/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Publish" }))
    expect(await screen.findByRole("button", { name: "Preview" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }))
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }))
    fireEvent.click(await screen.findByRole("button", { name: "Preview" }))
    expect(screen.queryByText("Editing Pitch")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Edit profile" })).toBeInTheDocument()
  })

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
      screen.getByRole("heading", { level: 1, name: SAMPLE_AUTHOR_NAME })
    ).toBeInTheDocument()
  })

  it("opens a story whose title matches each visible highlight chip", async () => {
    await loadedPitch()
    const highlights = starterPitchDocument().storyHighlights
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
    const starter = starterPitchDocument()
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
    const starter = starterPitchDocument()
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
      await screen.findByRole("heading", { level: 1, name: "Scout Tester" })
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
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }))
    fireEvent.click(screen.getByRole("button", { name: "Publish" }))
    fireEvent.click(await screen.findByRole("button", { name: "Preview" }))
    fireEvent.click(await screen.findByRole("button", { name: "Copy link" }))

    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument()
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

    const starter = starterPitchDocument()
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
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Copied" })).not.toBeInTheDocument()
  })

  it("adds a starter ACHIEVEMENT on an empty Pitch so Open Proof is smokeable", async () => {
    await loadedPitch()
    clickClearDemo()
    expect(await screen.findByText("Your Pitch is empty")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Start your Pitch" }))
    expect(screen.getByText("Editing Pitch")).toBeInTheDocument()
    expect(
      screen.getByText(/Add a Proof you can open — a checkout hallway study is ready/)
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
      screen.getByRole("button", { name: "Open Proof: Product card resize study" })
    )
    const viewer = screen.getByRole("dialog", {
      name: "Product card resize study",
    })
    expect(viewer).toBeInTheDocument()
    expect(within(viewer).getByText("E-commerce checkout · Side project")).toBeInTheDocument()
    expect(within(viewer).getByText("What I did")).toBeInTheDocument()
    expect(within(viewer).getByText(/12-person hallway test/i)).toBeInTheDocument()

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

  it("opens the checkout Proof from Achievements and closes it", async () => {
    await loadedPitch()

    fireEvent.click(
      screen.getByRole("button", { name: "Open Proof: Product card resize study" })
    )
    const viewer = screen.getByRole("dialog", {
      name: "Product card resize study",
    })
    expect(viewer).toBeInTheDocument()
    expect(within(viewer).getByText("E-commerce checkout · Side project")).toBeInTheDocument()
    expect(within(viewer).getByText("What I did")).toBeInTheDocument()
    expect(
      within(viewer).getByText(/12-person hallway test/i)
    ).toBeInTheDocument()

    fireEvent.click(within(viewer).getByRole("button", { name: "Close" }))
    expect(
      screen.queryByRole("dialog", { name: "Product card resize study" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 1, name: SAMPLE_AUTHOR_NAME })
    ).toBeInTheDocument()
  })

  it("opens the checkout Proof from a persisted dead-link achievement", async () => {
    const starter = starterPitchDocument()
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
      screen.getByRole("button", { name: "Open Proof: Product card resize study" })
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
    expect(screen.queryByText("Case study · Proof chain")).not.toBeInTheDocument()
    expect(screen.getAllByText(`@${github}`).length).toBeGreaterThan(0)
    expect(screen.getByText(SAMPLE_AUTHOR.email)).toBeInTheDocument()
    expect(screen.getByText("LinkedIn")).toBeInTheDocument()

    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /read case study/i })
    ).not.toBeInTheDocument()
    expect(document.querySelector("a[href]")).toBeNull()
    expect(
      screen.getAllByRole("button", { name: /open proof/i })
    ).toHaveLength(1)
  })

  it("does not show Copied when the clipboard write fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("blocked"))
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    })

    await loadedPitch()
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }))
    fireEvent.click(screen.getByRole("button", { name: "Publish" }))
    fireEvent.click(await screen.findByRole("button", { name: "Preview" }))
    fireEvent.click(await screen.findByRole("button", { name: "Copy link" }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled()
    })
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Copied" })).not.toBeInTheDocument()
  })

  it("persists hide and about edits through the Command door", async () => {
    await loadedPitch()

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }))
    const about = screen.getByRole("heading", { name: "About" }).closest("section")
    fireEvent.click(within(about as HTMLElement).getByRole("button", { name: "Hide" }))
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "About" })).not.toBeInTheDocument()
    })
    expect(readFirstCafeState(TEST_SESSION_USER.id).completed).toEqual(["pitch"])

    cleanup()
    await loadedPitch()
    expect(screen.queryByRole("heading", { name: "About" })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Achievements" })).toBeInTheDocument()
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
    const starter = starterPitchDocument()
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
      await screen.findByRole("heading", { level: 1, name: "Scout Tester" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Checkout highlight" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Checkout story" })).toHaveTextContent(
      "Checkout"
    )
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
    const starter = starterPitchDocument()
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
      await screen.findByRole("heading", { level: 1, name: "Scout Tester" })
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("button", { name: "Checkout highlight" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Moments" })).not.toBeInTheDocument()
    expect(screen.queryByText(/Alex Tran/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sacred space/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }))
    fireEvent.click(screen.getByRole("button", { name: "Add section" }))
    fireEvent.click(screen.getByRole("button", { name: BLOCK_LABELS.moments }))
    expect(await screen.findByRole("heading", { name: "Moments" })).toBeInTheDocument()

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

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }))
    const moments = screen.getByRole("heading", { name: "Moments" }).closest("section")
    expect(moments).not.toBeNull()
    fireEvent.click(within(moments as HTMLElement).getByRole("button", { name: "Hide" }))
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Moments" })).not.toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: "Checkout highlight" })).toBeInTheDocument()
    const stored = getMockPitchDoc()?.content as PitchDocument
    expect(stored.storyHighlights).toEqual(before.storyHighlights)
    expect(stored.bento.length).toBe(before.bento.length)
    expect(stored.blocks.find((block) => block.kind === "moments")?.hidden).toBe(true)
  })
})
