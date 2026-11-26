import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, within } from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { expectCoachIdle } from "@/test/coach-chat-helpers.ts"
import { setMockJobs } from "@/test/apply-jobs-mock.ts"
import { setMockProfile } from "@/test/profile-api-mock.ts"
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
import { renderApp } from "@/test/render-app.tsx"
import { FIXTURE_CHATS } from "@/test/chat-fixtures.ts"
import { getMockChats } from "@/test/chat-api-mock.ts"

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

describe("empty api data shows empty states, never sample content", () => {
  it("Paper lists no documents and offers the empty-list actions", async () => {
    getMockPaperDocs().splice(0)
    renderApp(SURFACE_PATHS.paper)

    expect(
      await screen.findByText("Start your first document")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New CV" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "New Letter" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Import" })).toBeEnabled()
    expectNone(samplePaperDocs().map((doc) => doc.name))
  })

  it("Apply shows one empty state and no sample card or Demo banner", async () => {
    getMockApplyCards().splice(0)
    setMockJobs([])
    renderApp(SURFACE_PATHS.apply)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Apply" })
    ).toBeInTheDocument()
    expect(await screen.findByText("Track your first job")).toBeInTheDocument()
    expect(
      screen.getAllByRole("button", { name: "New job" }).length
    ).toBeGreaterThan(0)
    expect(screen.queryByText(/^Nothing in /)).not.toBeInTheDocument()
    expectNone(sampleApplyCards().map((card) => card.title))
    expect(
      screen.queryByRole("button", { name: "Clear demo" })
    ).not.toBeInTheDocument()
  })

  it("Pitch shows the placeholder and no demo content", async () => {
    renderApp(SURFACE_PATHS.pitch)

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "One link that sells you",
      })
    ).toBeInTheDocument()
    expect(screen.queryByText("Demo content")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Moments" })
    ).not.toBeInTheDocument()
  })

  it("Coach opens empty, with no sample content", async () => {
    getMockChats().splice(0)
    getMockPaperDocs().splice(0)
    renderApp(SURFACE_PATHS.coach)

    await expectCoachIdle()
    expectNone(FIXTURE_CHATS.map((chat) => chat.title))
    expectNone(samplePaperDocs().map((doc) => doc.name))
    expectNone(sampleApplyCards().map((card) => card.title))
  })
})

describe("Apply shows no Fit label", () => {
  it("on the board, the card drawer or the calendar", async () => {
    renderApp(SURFACE_PATHS.apply)
    expect(
      await screen.findByRole("heading", { level: 1, name: "Apply" })
    ).toBeInTheDocument()
    expect(within(screen.getByRole("main")).queryAllByText(FIT_LABEL)).toEqual(
      []
    )
    fireEvent.click(screen.getByRole("radio", { name: "Calendar" }))
    expect(
      await screen.findByRole("radio", { name: "Calendar", checked: true })
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
      await screen.findByRole("heading", {
        level: 2,
        name: "One link that sells you",
      })
    ).toBeInTheDocument()

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
    setMockProfile({ name: "Scout Tester", email: "scout@example.com" })
    renderApp(SURFACE_PATHS.pitch)

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "One link that sells you",
      })
    ).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(PERSONA_NAMES)
  })
})
