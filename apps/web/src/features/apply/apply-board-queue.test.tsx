import { useQuery, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createQueryClient } from "@/lib/query-client.ts"
import { applyApiFetch } from "@/test/apply-api-mock.ts"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import {
  getMockJobPosts,
  getMockJobs,
  setMockJobs,
} from "@/test/apply-jobs-mock.ts"
import { pathOf } from "@/test/mock-http.ts"

import { jobListKey, listJobs } from "./apply-api.ts"
import { ApplyBoard } from "./apply-board.tsx"

type Handlers = {
  onDragStart: (event: unknown) => void
  onDragOver: (event: unknown) => void
  onDragEnd: (event: unknown) => void
}

const captured = vi.hoisted(() => ({ current: null as unknown }))

vi.mock("@tanstack/react-router", async (importActual) => ({
  ...(await importActual<typeof import("@tanstack/react-router")>()),
  useNavigate: () => () => Promise.resolve(),
}))

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
const handlers = () => captured.current as Handlers

function holdMoves() {
  const held: Array<() => void> = []
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (pathOf(input) === "/api/commands/job.move") {
        await new Promise<void>((resolve) => held.push(resolve))
      }
      const response = await applyApiFetch(input, init)
      if (!response) throw new Error(`Unexpected fetch: ${pathOf(input)}`)
      return response
    }
  )
  return async () => {
    while (held.length > 0) {
      held.shift()?.()
      await act(async () => {
        await Promise.resolve()
      })
    }
  }
}

function Board() {
  const query = useQuery({ queryKey: jobListKey(), queryFn: listJobs })
  return (
    <ApplyBoard
      jobs={query.data ?? []}
      showClosed={false}
      onShowClosed={() => {}}
    />
  )
}

async function drop(id: string, over: string) {
  const active = { id }
  await act(async () => {
    handlers().onDragStart({ active })
  })
  await act(async () => {
    handlers().onDragOver({ active, over: { id: over } })
  })
  await act(async () => {
    handlers().onDragEnd({ active, over: { id: over } })
  })
}

function columnOf(container: HTMLElement, id: string) {
  return container
    .querySelector(`[data-card-id="${id}"]`)
    ?.closest("[data-stage]")
    ?.getAttribute("data-stage")
}

describe("apply board move queue", () => {
  beforeEach(() => {
    setMockJobs([junior])
  })
  afterEach(() => {
    cleanup()
  })

  it("keeps the card where it was dropped when a refetch lands before its move finishes", async () => {
    const releaseAll = holdMoves()
    const queryClient = createQueryClient()
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <Board />
      </QueryClientProvider>
    )
    await waitFor(() => expect(columnOf(container, junior.id)).toBe("saved"))
    await drop(junior.id, "applied")
    await waitFor(() => expect(columnOf(container, junior.id)).toBe("applied"))
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: jobListKey() })
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(columnOf(container, junior.id)).toBe("applied")
    await releaseAll()
    await waitFor(() => expect(getMockJobs()[0]?.stage).toBe("applied"))
    await waitFor(() => expect(columnOf(container, junior.id)).toBe("applied"))
  }, 20000)

  it("sends the move back when the card is dropped on the column a stale refetch put it in", async () => {
    const releaseAll = holdMoves()
    const queryClient = createQueryClient()
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <Board />
      </QueryClientProvider>
    )
    await waitFor(() => expect(columnOf(container, junior.id)).toBe("saved"))
    await drop(junior.id, "applied")
    await waitFor(() => expect(columnOf(container, junior.id)).toBe("applied"))
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: jobListKey() })
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    await drop(junior.id, "saved")
    await releaseAll()
    await waitFor(() => {
      const moves = getMockJobPosts().filter((post) => post.name === "job.move")
      expect(moves.map((post) => post.input.stage)).toEqual([
        "applied",
        "saved",
      ])
    })
    await waitFor(() => expect(getMockJobs()[0]?.stage).toBe("saved"))
    await waitFor(() => expect(columnOf(container, junior.id)).toBe("saved"))
  }, 20000)
})
