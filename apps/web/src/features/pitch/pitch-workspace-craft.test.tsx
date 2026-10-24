import {
  legacyStarterPitchDocument,
  starterPitchDocument,
} from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import {
  getMockPitchDoc,
  resetPitchApiMock,
  setMockPitchDoc,
} from "@/test/pitch-api-mock.ts"
import {
  clickClearDemo,
  loadedPitch,
  renderPitch,
} from "@/test/pitch-test-helpers.tsx"

afterEach(() => {
  cleanup()
  resetPitchApiMock()
  vi.unstubAllGlobals()
})

describe("Pitch craft pass", () => {
  it("puts Publish on the unpublished banner row and publishes from it", async () => {
    await loadedPitch()

    const banner = screen.getByText(/only you can see it/i).parentElement!
    expect(screen.queryByText(/hit publish/i)).not.toBeInTheDocument()
    fireEvent.click(within(banner).getByRole("button", { name: "Publish" }))

    await waitFor(() => {
      expect(getMockPitchDoc()?.content).toMatchObject({ published: true })
    })
    expect(screen.queryByText(/only you can see it/i)).not.toBeInTheDocument()
  })

  it("keeps one h1 on the screen and sets the person's name under it", async () => {
    await loadedPitch()

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pitch")
    expect(
      screen.getByRole("heading", { level: 2, name: SAMPLE_AUTHOR_NAME })
    ).toBeInTheDocument()
  })

  it("keeps one Publish button while editing, in the edit bar", async () => {
    await loadedPitch()

    fireEvent.click(screen.getByRole("button", { name: "Edit Pitch" }))
    expect(screen.getByText("Editing Pitch")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Publish" })).toHaveLength(1)
  })

  it("names the edit action Edit Pitch and never Edit profile", async () => {
    await loadedPitch()

    expect(
      screen.getByRole("button", { name: "Edit Pitch" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Edit profile" })
    ).not.toBeInTheDocument()
  })

  it("captions the highlights in the product's words", async () => {
    await loadedPitch()

    expect(screen.getByText("Tap a highlight to play it.")).toBeInTheDocument()
    expect(screen.queryByText(/instagram/i)).not.toBeInTheDocument()
  })

  it("opens a new account on a one-line sample with one Proof and nothing else", async () => {
    setMockPitchDoc({
      id: "55555555-5555-7555-8555-555555555570",
      kind: "pitch",
      content: starterPitchDocument(),
      contentVersion: 1,
      createdAt: "2026-10-24T00:00:00.000Z",
      updatedAt: "2026-10-24T00:00:00.000Z",
    })
    const { container } = await renderLoaded()

    expect(screen.getByText("Open to intern roles")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /open proof/i })
    ).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\d\s*%|add-to-cart/i)
    expect(container.querySelector("img")).toBeNull()
    expect(
      screen.queryAllByRole("button", { name: /highlight$/ })
    ).toHaveLength(0)
    expect(screen.queryByText("Tap a highlight to play it.")).toBeNull()
    expect(screen.queryByRole("heading", { name: "Moments" })).toBeNull()
    expect(
      screen.getByText(/Clear it to start your Pitch\./)
    ).toBeInTheDocument()

    clickClearDemo()
    expect(
      await screen.findByRole("button", { name: "Start your Pitch" })
    ).toBeInTheDocument()
  })

  it("keeps the stored sample an older account already holds", async () => {
    await renderLoaded()

    expect(screen.getAllByRole("button", { name: /highlight$/ })).toHaveLength(
      3
    )
    expect(screen.getByRole("heading", { name: "Moments" })).toBeInTheDocument()
  })

  it("offers Add a photo as an empty slot only while editing", async () => {
    const sample = legacyStarterPitchDocument()
    setMockPitchDoc({
      id: "55555555-5555-7555-8555-555555555571",
      kind: "pitch",
      content: {
        ...sample,
        bento: sample.bento.map((card) => ({ ...card, image: undefined })),
      },
      contentVersion: 1,
      createdAt: "2026-10-24T00:00:00.000Z",
      updatedAt: "2026-10-24T00:00:00.000Z",
    })
    await loadedPitch()

    expect(screen.queryByRole("button", { name: /add a photo/i })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Edit Pitch" }))
    expect(screen.getByRole("button", { name: /add a photo/i })).toBeDisabled()
  })

  it("points the demo banner at Start your Pitch", async () => {
    await loadedPitch()

    expect(
      screen.getByText(/Clear it to start your Pitch\./)
    ).toBeInTheDocument()
    clickClearDemo()
    expect(
      await screen.findByRole("button", { name: "Start your Pitch" })
    ).toBeInTheDocument()
  })
})

async function renderLoaded() {
  const view = renderPitch()
  await screen.findByRole("heading", { level: 2, name: SAMPLE_AUTHOR_NAME })
  return view
}
