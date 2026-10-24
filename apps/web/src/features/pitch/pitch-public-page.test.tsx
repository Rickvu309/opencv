import { afterEach, describe, expect, it } from "vitest"
import { cleanup, screen } from "@testing-library/react"
import { starterPitchDocument } from "@workspace/domain"

import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { pitchHandle, publicPitchPath } from "@/features/pitch/pitch-types.ts"
import { setMockSession } from "@/test/auth-client-mock.ts"
import { setMockPitchDoc } from "@/test/pitch-api-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

const publishedSlug = pitchHandle(SAMPLE_AUTHOR_NAME)

function publishStarter() {
  const starter = starterPitchDocument()
  setMockPitchDoc({
    id: "55555555-5555-7555-8555-555555555555",
    kind: "pitch",
    content: { ...starter, published: true },
    contentVersion: 1,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
  })
}

afterEach(() => {
  cleanup()
})

describe("public Pitch URL", () => {
  it("serves the published Pitch at /u/:slug without app chrome", async () => {
    publishStarter()
    renderApp(publicPitchPath(publishedSlug))

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: SAMPLE_AUTHOR_NAME,
      })
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument()
    expect(
      screen.getByText(starterPitchDocument().headline)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Edit Pitch" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("complementary", { name: "App" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Not Found" })
    ).not.toBeInTheDocument()
  })

  it("serves the published Pitch when the viewer has no session", async () => {
    publishStarter()
    setMockSession(null)
    renderApp(publicPitchPath(publishedSlug))

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: SAMPLE_AUTHOR_NAME,
      })
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Not Found" })
    ).not.toBeInTheDocument()
  })

  it("stays honest Not Found for an unpublished slug", async () => {
    renderApp(publicPitchPath(publishedSlug))

    expect(
      await screen.findByRole("heading", { name: "Not Found" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("This Pitch is not published, or the link is wrong.")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { level: 1, name: SAMPLE_AUTHOR_NAME })
    ).not.toBeInTheDocument()
  })

  it("stays honest Not Found for an unknown slug", async () => {
    publishStarter()
    renderApp(publicPitchPath("no-such-user"))

    expect(
      await screen.findByRole("heading", { name: "Not Found" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { level: 1, name: SAMPLE_AUTHOR_NAME })
    ).not.toBeInTheDocument()
  })
})
