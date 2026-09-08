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
import {
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
    fireEvent.click(screen.getByRole("button", { name: "Checkout story" }))
    const viewer = screen.getByRole("dialog", { name: "Work story viewer" })
    expect(within(viewer).getByText("Checkout")).toBeInTheDocument()
    expect(within(viewer).getByText("Hallway test setup")).toBeInTheDocument()
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

    cleanup()
    await loadedPitch()
    expect(screen.queryByRole("heading", { name: "About" })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Achievements" })).toBeInTheDocument()
  })
})
