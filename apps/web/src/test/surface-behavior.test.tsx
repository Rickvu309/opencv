import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, within } from "@testing-library/react"

import {
  emptyPitchDocument,
  PITCH_CONTENT_KIND,
  PITCH_CONTENT_VERSION,
} from "@workspace/domain"

import { APPLY_OPEN_GUIDE } from "@/features/apply/apply-search.ts"
import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { apiBaseUrl } from "@/lib/api-url.ts"
import { getMockApplyCards } from "@/test/apply-api-mock.ts"
import { sampleApplyCards } from "@/test/apply-fixtures.ts"
import {
  setMockSession,
  TEST_SESSION,
  TEST_SESSION_USER,
} from "@/test/auth-client-mock.ts"
import { getMockPaperDocs } from "@/test/paper-api-mock.ts"
import { samplePaperDocs } from "@/test/paper-fixtures.ts"
import { setMockPitchDoc } from "@/test/pitch-api-mock.ts"
import { renderApp } from "@/test/render-app.tsx"
import { FIXTURE_THREADS } from "@/test/thread-fixtures.ts"
import { getMockThreads } from "@/test/threads-api-mock.ts"

const FIT_LABEL = /\bfit\b|\/ 100/i
const PERSONA_NAMES = /Alex Tran|alex-tran|Eric Nguyen|eric-nguyen/i

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

function expectNone(texts: string[]) {
  for (const text of texts) {
    expect(screen.queryByText(text), text).not.toBeInTheDocument()
  }
}

function emptyPitch() {
  setMockPitchDoc({
    id: "55555555-5555-7555-8555-555555555562",
    kind: PITCH_CONTENT_KIND,
    content: emptyPitchDocument(),
    contentVersion: PITCH_CONTENT_VERSION,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
  })
}

describe("empty api data shows empty states, never sample content", () => {
  it("Paper lists no documents and offers the empty-list actions", async () => {
    getMockPaperDocs().splice(0)
    renderApp(SURFACE_PATHS.paper)

    expect(
      await screen.findByRole("button", { name: "Start a Letter" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Add a Proof" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Start a CV" })
    ).toBeInTheDocument()
    expectNone(samplePaperDocs().map((doc) => doc.name))
  })

  it("Apply shows one empty state and no sample card or Demo banner", async () => {
    getMockApplyCards().splice(0)
    renderApp(SURFACE_PATHS.apply)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Apply" })
    ).toBeInTheDocument()
    expect(await screen.findByText("No opportunities yet")).toBeInTheDocument()
    expect(
      screen.getAllByRole("button", { name: "Add opportunity" }).length
    ).toBeGreaterThan(0)
    expect(screen.queryByText(/^Nothing in /)).not.toBeInTheDocument()
    expectNone(sampleApplyCards().map((card) => card.title))
    expect(
      screen.queryByRole("button", { name: "Clear demo" })
    ).not.toBeInTheDocument()
  })

  it("Pitch shows the empty state and no demo content", async () => {
    emptyPitch()
    renderApp(SURFACE_PATHS.pitch)

    expect(await screen.findByText("Your Pitch is empty")).toBeInTheDocument()
    expect(screen.queryByText("Demo content")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Moments" })
    ).not.toBeInTheDocument()
  })

  it("Home shows the greeting and no sample thread", async () => {
    getMockThreads().splice(0)
    renderApp(SURFACE_PATHS.home)

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /^Good (morning|afternoon|evening),/,
      })
    ).toBeInTheDocument()
    expectNone(FIXTURE_THREADS.map((thread) => thread.title))
    expectNone(samplePaperDocs().map((doc) => doc.name))
    expectNone(sampleApplyCards().map((card) => card.title))
  })
})

describe("Apply shows no Fit label", () => {
  it("on the board, the card drawer or the calendar", async () => {
    renderApp(`${SURFACE_PATHS.apply}?open=${APPLY_OPEN_GUIDE}`)
    expect(
      await screen.findByRole("heading", { level: 1, name: "Apply" })
    ).toBeInTheDocument()
    const drawer = await screen.findByRole("complementary", {
      name: "Opportunity detail",
    })
    expect(
      within(drawer).getByDisplayValue("Associate PM intern")
    ).toBeInTheDocument()
    expect(within(screen.getByRole("main")).queryAllByText(FIT_LABEL)).toEqual(
      []
    )
    expect(within(drawer).queryAllByText(FIT_LABEL)).toEqual([])

    fireEvent.click(screen.getByRole("button", { name: "Calendar" }))
    expect(
      await screen.findByRole("button", { name: "Board" })
    ).toBeInTheDocument()
    expect(within(screen.getByRole("main")).queryAllByText(FIT_LABEL)).toEqual(
      []
    )
  })
})

describe("Pitch makes no third-party requests", () => {
  it("sends every request to the api origin", async () => {
    const requested: string[] = []
    renderApp(SURFACE_PATHS.pitch, (input) => {
      const raw =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      requested.push(new URL(raw, apiBaseUrl).href)
    })

    expect(
      await screen.findByRole("heading", { name: "GitHub" })
    ).toBeInTheDocument()

    expect(requested.length).toBeGreaterThan(0)
    for (const href of requested) {
      expect(new URL(href).origin, href).toBe(new URL(apiBaseUrl).origin)
    }
  })
})

describe("Pitch does not seed a persona", () => {
  it("shows the signed-in User and no leftover sample name", async () => {
    setMockSession({
      user: {
        ...TEST_SESSION_USER,
        name: "Scout Tester",
        email: "scout@example.com",
      },
      session: TEST_SESSION,
    })
    renderApp(SURFACE_PATHS.pitch)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Scout Tester" })
    ).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(PERSONA_NAMES)
  })
})
