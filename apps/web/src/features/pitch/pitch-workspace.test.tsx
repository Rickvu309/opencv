import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import {
  SAMPLE_AUTHOR,
  SAMPLE_AUTHOR_NAME,
} from "@/features/seed/sample-author.ts"
import { SURFACE_COPY } from "@/features/app-shell/surfaces.ts"
import { getMockGithubUsername } from "@/features/pitch/pitch-github-mock.ts"
import { PitchWorkspace } from "@/features/pitch/pitch-workspace.tsx"
import { BLOCK_LABELS, getPitchProfile } from "@/features/pitch/pitch-types.ts"

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderPitch() {
  return render(createElement(PitchWorkspace))
}

describe("Pitch workspace", () => {
  it("renders the placeholder User portfolio with mock GitHub activity", () => {
    renderPitch()
    const profile = getPitchProfile()

    expect(
      screen.getByRole("heading", { level: 1, name: SAMPLE_AUTHOR_NAME })
    ).toBeInTheDocument()
    expect(screen.getByText(profile.headline)).toBeInTheDocument()
    expect(screen.getByText(profile.slug)).toBeInTheDocument()
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
    expect(
      screen.getAllByText(`@${getMockGithubUsername()}`).length
    ).toBeGreaterThan(0)
    expect(screen.getByText("Connected · mock integration")).toBeInTheDocument()
    expect(screen.getAllByTitle(/contribution/i).length).toBeGreaterThan(50)
    expect(
      screen.getByRole("button", { name: "Checkout highlight" })
    ).toBeInTheDocument()
    expect(screen.queryByText(/Eric Nguyen/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/eric-nguyen/i)).not.toBeInTheDocument()
    expect(screen.queryByText(SURFACE_COPY.pitch.body)).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("lets the User edit, hide, and restore showcase blocks", () => {
    renderPitch()

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
    expect(
      screen.queryByRole("heading", { name: "About" })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Add section" }))
    fireEvent.click(screen.getByRole("button", { name: BLOCK_LABELS.about }))
    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Add section" }))
    fireEvent.click(screen.getByRole("button", { name: BLOCK_LABELS.gallery }))
    expect(screen.getByRole("heading", { name: "Gallery" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }))
    expect(screen.getByText(/unpublished/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Publish" }))
    fireEvent.click(screen.getByRole("button", { name: "Preview" }))
    expect(screen.queryByText("Editing Pitch")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Edit profile" })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("opens and closes a story highlight without leaving the page", () => {
    renderPitch()

    fireEvent.click(screen.getByRole("button", { name: "Checkout highlight" }))
    const viewer = screen.getByRole("dialog", { name: "Work story viewer" })
    expect(viewer).toBeInTheDocument()
    expect(within(viewer).getByText("Hallway test setup")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(
      screen.queryByRole("dialog", { name: "Work story viewer" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 1, name: SAMPLE_AUTHOR_NAME })
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("only claims Copy link succeeded when the clipboard write works", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    })

    renderPitch()
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }))

    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(
      `https://${getPitchProfile().slug}`
    )
  })

  it("does not present showcase or contact rows as links that go nowhere", () => {
    renderPitch()

    expect(screen.getByText("Read case study")).toBeInTheDocument()
    expect(screen.getByText("Case study · Proof chain")).toBeInTheDocument()
    expect(
      screen.getAllByText(`@${getMockGithubUsername()}`).length
    ).toBeGreaterThan(0)
    expect(screen.getByText(SAMPLE_AUTHOR.email)).toBeInTheDocument()
    expect(screen.getByText("LinkedIn")).toBeInTheDocument()

    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /read case study/i })
    ).not.toBeInTheDocument()
    expect(document.querySelector("a[href]")).toBeNull()
  })

  it("does not show Copied when the clipboard write fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("blocked"))
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    })

    renderPitch()
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled()
    })
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Copied" })).not.toBeInTheDocument()
  })
})
