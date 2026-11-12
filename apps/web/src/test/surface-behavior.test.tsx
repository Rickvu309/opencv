import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, within } from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { expectCoachIdle } from "@/test/coach-chat-helpers.ts"
import { setMockJobs } from "@/test/apply-jobs-mock.ts"
import { getMockApplyCards } from "@/test/apply-api-mock.ts"
import { sampleApplyCards } from "@/test/apply-fixtures.ts"
import { getMockPaperDocs } from "@/test/paper-api-mock.ts"
import { samplePaperDocs } from "@/test/paper-fixtures.ts"
import { renderApp } from "@/test/render-app.tsx"
import { FIXTURE_CHATS } from "@/test/chat-fixtures.ts"
import { getMockChats } from "@/test/chat-api-mock.ts"

const FIT_LABEL = /\bfit\b|\/ 100/i

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

    expect(await screen.findByText("Start a document")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "CV" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Cover letter" })
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole("button", { name: "Import", exact: true })
    ).toHaveLength(2)
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
      screen.getAllByRole("button", { name: "Add job" }).length
    ).toBeGreaterThan(0)
    expect(screen.queryByText(/^Nothing in /)).not.toBeInTheDocument()
    expectNone(sampleApplyCards().map((card) => card.title))
    expect(
      screen.queryByRole("button", { name: "Clear demo" })
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
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }))
    expect(
      await screen.findByRole("button", { name: "Board" })
    ).toBeInTheDocument()
    expect(within(screen.getByRole("main")).queryAllByText(FIT_LABEL)).toEqual(
      []
    )
  })
})
