import { act, cleanup, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderApp } from "@/test/render-app.tsx"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import { getMockJobPosts, setMockJobs } from "@/test/apply-jobs-mock.ts"

type Handlers = {
  onDragStart: (event: unknown) => void
  onDragOver: (event: unknown) => void
  onDragEnd: (event: unknown) => void
}

const captured = vi.hoisted(() => ({ current: null as unknown }))

// The real sensor decides the drop target from measured rects, which jsdom
// cannot fake into "no column under the card". The stand-in keeps the board's
// own handlers and lets the test drive the event sequence directly.
vi.mock("@workspace/ui/components/kanban", async (importActual) => {
  const actual =
    await importActual<typeof import("@workspace/ui/components/kanban")>()
  return {
    ...actual,
    KanbanProvider: (props: Record<string, unknown>) => {
      captured.current = props
      return (actual.KanbanProvider as (p: unknown) => unknown)(props)
    },
  }
})

const junior = mockJob()

describe("apply board keyboard drop", () => {
  beforeEach(() => {
    setMockJobs([])
  })
  afterEach(() => {
    cleanup()
  })

  it("moves the card to the last column it hovered when the drop reports none", async () => {
    setMockJobs([junior])
    renderApp("/apply")
    await screen.findByRole("button", {
      name: "Junior Marketing, Lumière Cosmetics",
    })
    const handlers = () => captured.current as Handlers
    const active = { id: junior.id }
    await act(async () => {
      handlers().onDragStart({ active })
    })
    await act(async () => {
      handlers().onDragOver({ active, over: { id: "applied" } })
    })
    await act(async () => {
      handlers().onDragEnd({ active, over: null })
    })
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) =>
            post.name === "job.move" &&
            post.input.jobId === junior.id &&
            post.input.stage === "applied"
        )
      ).toBe(true)
    })
  }, 20000)

  it("keeps the card in place when the drag never hovered a column", async () => {
    setMockJobs([junior])
    renderApp("/apply")
    await screen.findByRole("button", {
      name: "Junior Marketing, Lumière Cosmetics",
    })
    const handlers = () => captured.current as Handlers
    const active = { id: junior.id }
    await act(async () => {
      handlers().onDragStart({ active })
    })
    await act(async () => {
      handlers().onDragEnd({ active, over: null })
    })
    expect(getMockJobPosts().some((post) => post.name === "job.move")).toBe(
      false
    )
  }, 20000)
})
