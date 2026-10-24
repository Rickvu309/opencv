import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import {
  emptyPitchDocument,
  STARTER_PITCH_ABOUT_LEAD,
  STARTER_PITCH_HEADLINE,
  legacyStarterPitchDocument,
  type PitchDocument,
} from "@workspace/domain"
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { TEST_SESSION_USER } from "@/test/auth-client-mock.ts"
import { SURFACE_COPY } from "@/features/app-shell/surfaces.ts"
import { getMockGithubUsername } from "@/features/pitch/pitch-github-mock.ts"
import { readFirstCafeState } from "@/features/home/first-cafe-checklist.ts"
import { BLOCK_LABELS, pitchHandle } from "@/features/pitch/pitch-types.ts"
import {
  getMockPitchDoc,
  resetPitchApiMock,
  setMockPitchDoc,
} from "@/test/pitch-api-mock.ts"
import {
  renderPitch,
  clearDemoButtons,
  clickClearDemo,
  expectSampleMomentsGone,
  loadedPitch,
} from "@/features/pitch/pitch-test-helpers.tsx"

afterEach(() => {
  cleanup()
  resetPitchApiMock()
  vi.unstubAllGlobals()
})

describe("Pitch workspace", () => {
  it("renders the session User portfolio with mock GitHub activity", async () => {
    await loadedPitch()
    const starter = legacyStarterPitchDocument()
    const github = getMockGithubUsername(SAMPLE_AUTHOR_NAME)

    expect(screen.getByText(starter.headline)).toBeInTheDocument()
    expect(starter.headline).toBe(STARTER_PITCH_HEADLINE)
    expect(screen.getByText("Demo content")).toBeInTheDocument()
    expect(
      screen.getByText(/This page is a sample, not your story\./)
    ).toBeInTheDocument()
    expect(clearDemoButtons().length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText("Editing Pitch")).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Aspiring product manager/i)
    ).not.toBeInTheDocument()
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
    expect(
      within(demoBar).getByRole("button", { name: "Clear demo" })
    ).toBeInTheDocument()
    expect(demoBar.closest(".overflow-auto")).toBeNull()
    expect(screen.queryByText("Editing Pitch")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("dialog", { name: /clear|wipe|reset|confirm/i })
    ).not.toBeInTheDocument()
  })

  it("still offers Clear demo when sample About is present without the demo flag", async () => {
    const starter = legacyStarterPitchDocument()
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
    expect(await screen.findByText("Your Pitch is empty")).toBeInTheDocument()
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
    expect(
      screen.queryByText(/Aspiring product manager/i)
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: SAMPLE_AUTHOR_NAME })
    ).toBeInTheDocument()
    expect(getMockPitchDoc()?.content).toEqual(emptyPitchDocument())
    expect(readFirstCafeState(TEST_SESSION_USER.id).wins).toEqual(["pitch"])
    expect(readFirstCafeState(TEST_SESSION_USER.id).completed).toEqual([])
    expectSampleMomentsGone()

    fireEvent.click(screen.getByRole("button", { name: "Start your Pitch" }))
    expect(screen.getByText("Editing Pitch")).toBeInTheDocument()
    expectSampleMomentsGone()
    expect(
      screen.queryByRole("heading", { name: "Moments" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "GitHub" })
    ).not.toBeInTheDocument()
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
    const about = screen
      .getByRole("heading", { name: "About" })
      .closest("section")
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
    expect(
      screen.queryByRole("heading", { name: "Moments" })
    ).not.toBeInTheDocument()
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
    const about = screen
      .getByRole("heading", { name: "About" })
      .closest("section")
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
    expect(
      screen.queryByRole("heading", { name: "Moments" })
    ).not.toBeInTheDocument()
    const addAchievement = screen.getByRole("button", {
      name: /add achievement/i,
    })
    expect(addAchievement).toBeEnabled()
    expect(addAchievement).not.toHaveTextContent("Coming soon")
  })

  it("heals a cleared Pitch that still stored leftover sample Moments", async () => {
    const starter = legacyStarterPitchDocument()
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
    expect(await screen.findByText("Your Pitch is empty")).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole("button", { name: "Edit Pitch" }))
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
    expect(screen.getByRole("button", { name: /add card/i })).toBeDisabled()

    const about = screen
      .getByRole("heading", { name: "About" })
      .closest("section")
    expect(about).not.toBeNull()
    fireEvent.click(
      within(about as HTMLElement).getByRole("button", { name: "Hide" })
    )
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "About" })
      ).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Add section" }))
    fireEvent.click(screen.getByRole("button", { name: BLOCK_LABELS.about }))
    expect(
      await screen.findByRole("heading", { name: "About" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Add section" }))
    fireEvent.click(screen.getByRole("button", { name: BLOCK_LABELS.gallery }))
    expect(
      await screen.findByRole("heading", { name: "Gallery" })
    ).toBeInTheDocument()

    expect(screen.getByText(/unpublished/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Publish" }))
    expect(
      await screen.findByRole("button", { name: "Preview" })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }))
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }))
    fireEvent.click(await screen.findByRole("button", { name: "Preview" }))
    expect(screen.queryByText("Editing Pitch")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Edit Pitch" })
    ).toBeInTheDocument()
  })
})
