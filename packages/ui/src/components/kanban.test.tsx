import * as dndCore from "@dnd-kit/core"
import * as dndSortable from "@dnd-kit/sortable"
import * as motionModule from "@workspace/ui/lib/motion"
import "@testing-library/jest-dom/vitest"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from "./kanban"

const columns = [
  { id: "saved", name: "Saved" },
  { id: "applied", name: "Applied" },
  { id: "interview", name: "Interview" },
]

type Card = { id: string; name: string; column: string }

const initial: Card[] = [
  { id: "card-saved", name: "Northwind role", column: "saved" },
  { id: "card-interview", name: "Later role", column: "interview" },
]

function Board({ onDataChange }: { onDataChange: (data: Card[]) => void }) {
  const [data, setData] = useState(initial)
  return (
    <KanbanProvider
      columns={columns}
      data={data}
      onDataChange={(next) => {
        setData(next)
        onDataChange(next)
      }}
    >
      {(column) => (
        <KanbanBoard key={column.id} id={column.id} data-column={column.id}>
          <KanbanHeader>{column.name}</KanbanHeader>
          <KanbanCards id={column.id}>
            {(item) => (
              <KanbanCard key={item.id} id={item.id} name={item.name}>
                {item.name}
              </KanbanCard>
            )}
          </KanbanCards>
        </KanbanBoard>
      )}
    </KanbanProvider>
  )
}

describe("kanban keyboard move", () => {
  afterEach(() => {
    cleanup()
  })

  it("steps one arrow onto the next empty column and names it", async () => {
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const board = this.closest("[data-slot='kanban-board']")
        const columnId = board?.getAttribute("data-column")
        const index = columns.findIndex((column) => column.id === columnId)
        const card = this.closest("[data-slot='kanban-card']")
        if (index < 0) return new DOMRect(0, 0, 800, 600)
        if (card) return new DOMRect(index * 300 + 16, 48, 200, 64)
        return new DOMRect(index * 300, 0, 260, 1200)
      })

    const changes: Card[][] = []
    try {
      render(<Board onDataChange={(next) => changes.push(next)} />)
      const card = screen.getByRole("button", { name: "Northwind role" })

      async function key(target: EventTarget, code: string) {
        await act(async () => {
          fireEvent.keyDown(target, {
            code,
            key: code === "Space" ? " " : code,
          })
          await new Promise((resolve) => setTimeout(resolve, 0))
        })
      }

      card.focus()
      await key(card, "Space")
      await key(document, "ArrowRight")

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent(
          'Dragged the card "Northwind role" over the "Applied" column'
        )
      })
      expect(screen.getByRole("status")).not.toHaveTextContent("undefined")

      await key(document, "Space")

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent(
          'Dropped the card "Northwind role" into the "Applied" column'
        )
      })
      expect(screen.getByRole("status")).not.toHaveTextContent("undefined")

      await waitFor(() => {
        const last = changes.at(-1)
        expect(last?.find((item) => item.id === "card-saved")?.column).toBe(
          "applied"
        )
      })
      expect(
        changes.some(
          (data) =>
            data.find((item) => item.id === "card-saved")?.column ===
            "interview"
        )
      ).toBe(false)
    } finally {
      rect.mockRestore()
    }
  })
})

describe("kanban drop landing", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    Reflect.deleteProperty(HTMLElement.prototype, "animate")
  })

  it("keeps the card in the overlay until the drop animation lands", async () => {
    vi.spyOn(motionModule, "motionToken").mockReturnValue({
      duration: 280,
      easing: "ease-out",
    })
    vi.spyOn(motionModule, "prefersReducedMotion").mockReturnValue(false)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const board = this.closest("[data-slot='kanban-board']")
        const index = columns.findIndex(
          (column) => column.id === board?.getAttribute("data-column")
        )
        const card = this.closest("[data-slot='kanban-card']")
        if (index < 0) return new DOMRect(0, 0, 800, 600)
        if (card) return new DOMRect(index * 300 + 16, 48, 200, 64)
        return new DOMRect(index * 300, 0, 260, 1200)
      }
    )
    const computed = window.getComputedStyle.bind(window)
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      const style = computed(element)
      return new Proxy(style, {
        get(target, property) {
          if (property === "transform") return "matrix(1, 0, 0, 1, 300, 0)"
          const value = Reflect.get(target, property)
          return typeof value === "function" ? value.bind(target) : value
        },
      })
    })
    const landing: { onfinish: (() => void) | null } = { onfinish: null }
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: () => landing,
    })

    render(<Board onDataChange={() => {}} />)
    const card = screen.getByRole("button", { name: "Northwind role" })
    async function key(target: EventTarget, code: string) {
      await act(async () => {
        fireEvent.keyDown(target, {
          code,
          key: code === "Space" ? " " : code,
        })
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
    }
    card.focus()
    await key(card, "Space")
    await key(document, "ArrowRight")
    await key(document, "Space")

    await waitFor(() => expect(landing.onfinish).not.toBeNull())
    const overlay = document.querySelector("[data-slot='kanban-overlay']")
    expect(overlay).toHaveTextContent("Northwind role")
    expect(overlay?.firstElementChild).not.toHaveAttribute("data-lifted")

    await act(async () => {
      landing.onfinish?.()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await waitFor(() =>
      expect(
        document.querySelector("[data-slot='kanban-overlay']")?.textContent ??
          ""
      ).not.toContain("Northwind role")
    )
  })
})

describe("kanban motion tokens", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("passes motion tokens to useSortable and DragOverlay when motion is normal", () => {
    vi.spyOn(motionModule, "motionToken").mockImplementation((kind) => {
      if (kind === "micro") {
        return { duration: 150, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      }
      return { duration: 280, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }
    })
    vi.spyOn(motionModule, "prefersReducedMotion").mockReturnValue(false)
    const useSortableSpy = vi.spyOn(dndSortable, "useSortable")
    const dragOverlaySpy = vi.spyOn(dndCore.DragOverlay, "type")

    render(<Board onDataChange={() => {}} />)

    expect(useSortableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        transition: {
          duration: 150,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      })
    )
    expect(dragOverlaySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dropAnimation: expect.objectContaining({
          duration: 280,
          easing: "cubic-bezier(0.32, 0.72, 0, 1)",
        }),
      }),
      undefined
    )
  })

  it("passes null transitions to useSortable and DragOverlay when motion is reduced", () => {
    vi.spyOn(motionModule, "motionToken").mockImplementation((kind) => {
      if (kind === "micro") {
        return { duration: 150, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      }
      return { duration: 280, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }
    })
    vi.spyOn(motionModule, "prefersReducedMotion").mockReturnValue(true)
    const useSortableSpy = vi.spyOn(dndSortable, "useSortable")
    const dragOverlaySpy = vi.spyOn(dndCore.DragOverlay, "type")

    render(<Board onDataChange={() => {}} />)

    expect(useSortableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        transition: null,
      })
    )
    expect(dragOverlaySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dropAnimation: null,
      }),
      undefined
    )
  })

  it("adds lift classes to the overlay card when picked up", async () => {
    render(<Board onDataChange={() => {}} />)
    const card = screen.getByRole("button", { name: "Northwind role" })
    await act(async () => {
      fireEvent.keyDown(card, { code: "Space", key: " " })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const overlay = document.querySelector("[data-slot='kanban-overlay']")
    expect(overlay).not.toBeNull()
    const overlayCard = overlay?.firstElementChild
    expect(overlayCard?.className).toContain("scale-[1.02]")
    expect(overlayCard?.className).toContain("shadow-md")
    expect(overlayCard?.className).toContain("starting:scale-100")
    expect(overlayCard?.getAttribute("data-lifted")).toBe("true")
  })
})
