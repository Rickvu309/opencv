import { createElement, type ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { starterPitchDocument } from "@workspace/domain"

import {
  SAMPLE_AUTHOR,
  SAMPLE_AUTHOR_NAME,
} from "@/features/seed/sample-author.ts"
import { SURFACE_COPY } from "@/features/app-shell/surfaces.ts"
import { getMockGithubUsername } from "@/features/pitch/pitch-github-mock.ts"
import { PitchWorkspace } from "@/features/pitch/pitch-workspace.tsx"
import { BLOCK_LABELS, pitchHandle } from "@/features/pitch/pitch-types.ts"
import { createQueryClient } from "@/lib/query-client.ts"
import { pitchApiFetch } from "@/test/pitch-api-mock.ts"

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

async function loadedPitch() {
  renderPitch()
  expect(
    await screen.findByRole("heading", { level: 1, name: SAMPLE_AUTHOR_NAME })
  ).toBeInTheDocument()
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Pitch workspace", () => {
  it("renders the session User portfolio with mock GitHub activity", async () => {
    await loadedPitch()
    const starter = starterPitchDocument()
    const github = getMockGithubUsername(SAMPLE_AUTHOR_NAME)

    expect(screen.getByText(starter.headline)).toBeInTheDocument()
    expect(
      screen.getByText(`openpath.app/u/${pitchHandle(SAMPLE_AUTHOR_NAME)}`)
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
    expect(within(viewer).getByText("Hallway test setup")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(
      screen.queryByRole("dialog", { name: "Work story viewer" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 1, name: SAMPLE_AUTHOR_NAME })
    ).toBeInTheDocument()
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
      `https://openpath.app/u/${pitchHandle(SAMPLE_AUTHOR_NAME)}`
    )
  })

  it("does not present showcase or contact rows as links that go nowhere", async () => {
    await loadedPitch()
    const github = getMockGithubUsername(SAMPLE_AUTHOR_NAME)

    expect(screen.getByText("Read case study")).toBeInTheDocument()
    expect(screen.getByText("Case study · Proof chain")).toBeInTheDocument()
    expect(screen.getAllByText(`@${github}`).length).toBeGreaterThan(0)
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

    cleanup()
    await loadedPitch()
    expect(screen.queryByRole("heading", { name: "About" })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Achievements" })).toBeInTheDocument()
  })
})
