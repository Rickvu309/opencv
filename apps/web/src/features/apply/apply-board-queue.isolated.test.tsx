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

import { jobListQuery } from "./apply-api.ts"
import { ApplyBoard } from "./apply-board.tsx"

type Handlers = {
  onDragStart: (event: unknown) => void
  onDragOver: (event: unknown) => void
  onDragEnd: (event: unknown) => void
}

const captured = vi.hoisted(() => ({ current: null as unknown }))
const undos = vi.hoisted(() => [] as Array<() => void>)

vi.mock("@workspace/ui/components/sonner", async (importActual) => ({
  ...(await importActual<typeof import("@workspace/ui/components/sonner")>()),
  toastWithUndo: (_message: string, onUndo: () => void) => {
    undos.push(onUndo)
  },
}))

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
const senior = mockJob({
  id: "01900000-0000-7000-8000-000000000011",
  title: "Senior Marketing",
  position: "a1",
})
const handlers = () => captured.current as Handlers

function holdMoves() {
  const held: Array<{ body: string; resolve: () => void }> = []
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (pathOf(input) === "/api/commands/job.move") {
        const body = String(init?.body ?? "")
        await new Promise<void>((resolve) => held.push({ body, resolve }))
      }
      const response = await applyApiFetch(input, init)
      if (!response) throw new Error(`Unexpected fetch: ${pathOf(input)}`)
      return response
    }
  )
  const releaseAll = async () => {
    while (held.length > 0) {
      held.shift()?.resolve()
      await act(async () => {
        await Promise.resolve()
      })
    }
  }
  const release = async (jobId: string) => {
    const at = held.findIndex((move) => move.body.includes(jobId))
    const [move] = held.splice(at, 1)
    move?.resolve()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
  }
  return { releaseAll, release }
}

function Board({ showClosed = false }: { showClosed?: boolean }) {
  const query = useQuery(jobListQuery(""))
  return (
    <ApplyBoard
      jobs={query.data ?? []}
      showClosed={showClosed}
      onShowClosed={() => {}}
      onNewJob={() => {}}
      onOpenJob={() => {}}
      openJobId={null}
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
    undos.length = 0
  })
  afterEach(() => {
    cleanup()
  })

  it("keeps the card where it was dropped when a refetch lands before its move finishes, then refreshes once that last pending move settles", async () => {
    const { releaseAll } = holdMoves()
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
      await queryClient.invalidateQueries({
        queryKey: jobListQuery("").queryKey,
      })
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(columnOf(container, junior.id)).toBe("applied")
    await releaseAll()
    await waitFor(() => expect(getMockJobs()[0]?.stage).toBe("applied"))
    await waitFor(() => expect(columnOf(container, junior.id)).toBe("applied"))
  }, 20000)

  it("sends the move back when the card is dropped on the column a stale refetch put it in", async () => {
    const { releaseAll } = holdMoves()
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
      await queryClient.invalidateQueries({
        queryKey: jobListQuery("").queryKey,
      })
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

  it("puts a closed card back on Undo while another card's move is still in flight", async () => {
    setMockJobs([junior, senior])
    const { releaseAll, release } = holdMoves()
    const queryClient = createQueryClient()
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <Board showClosed />
      </QueryClientProvider>
    )
    await waitFor(() => expect(columnOf(container, junior.id)).toBe("saved"))
    await drop(senior.id, "applied")
    await drop(junior.id, "closed")
    await release(junior.id)
    await waitFor(() => expect(undos).toHaveLength(1))
    expect(columnOf(container, junior.id)).toBe("closed")
    await act(async () => {
      undos[0]?.()
    })
    await waitFor(() => expect(getMockJobs()[0]?.stage).toBe("saved"))
    await waitFor(() => expect(columnOf(container, junior.id)).toBe("saved"))
    expect(columnOf(container, senior.id)).toBe("applied")
    await releaseAll()
  }, 20000)
})
