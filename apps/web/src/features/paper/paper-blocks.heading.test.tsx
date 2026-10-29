import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { DroppableContainer } from "@dnd-kit/core"
import type { CvBlockDocument, CvSectionKind } from "@workspace/domain"

import { headingPointerCollision, PaperBlocks } from "./paper-blocks.tsx"
import { dropBlock } from "./paper-block-drop.ts"

const kinds = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "activities",
  "awards",
  "languages",
] as const satisfies readonly CvSectionKind[]

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function rect(top: number, height: number): DOMRect {
  return new DOMRect(0, top, 240, height)
}

function container(
  id: string,
  node: HTMLElement,
  cached: DOMRect
): DroppableContainer {
  return {
    id,
    key: id,
    disabled: false,
    node: { current: node },
    rect: { current: cached },
    data: { current: {} },
  }
}

describe.each(kinds)("%s heading drop", (kind) => {
  it.each([100, 114, 128, 133])(
    "resolves the live pointer at y=%s before placing the block",
    (y) => {
      const document: CvBlockDocument = {
        version: 2,
        header: { name: "", email: "", phone: "", city: "", linkedin: "" },
        sections: [
          {
            id: "source",
            kind: kind === "experience" ? "projects" : "experience",
            blocks: [{ id: "drag", type: "text", text: "Move" }],
          },
          {
            id: "target",
            kind,
            blocks: [{ id: "first", type: "text", text: "Stay" }],
          },
        ],
      }
      render(
        <PaperBlocks
          document={document}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onAskCoach={vi.fn()}
        />
      )
      const label = kind.charAt(0).toUpperCase() + kind.slice(1)
      const heading = screen.getByRole("heading", { name: label, exact: true })
      vi.spyOn(heading, "getBoundingClientRect").mockReturnValue(rect(100, 28))
      const block = heading.parentElement!.querySelector<HTMLElement>(
        "[data-sortable-block]"
      )!
      // Cached rectangles can lag the visible heading after scrolling during a drag.
      const containers = [
        container("section:target", heading, rect(20, 28)),
        container("first", block, rect(132, 80)),
      ]
      const collisions = headingPointerCollision({
        active: {
          id: "drag",
          data: { current: {} },
          rect: { current: { initial: null, translated: null } },
        },
        collisionRect: rect(132, 80),
        droppableRects: new Map(
          containers.map((item) => [item.id, item.rect.current!])
        ),
        droppableContainers: containers,
        pointerCoordinates: { x: 120, y },
      })
      const next = dropBlock(document, "drag", String(collisions[0]?.id))
      expect(
        next.sections
          .find((section) => section.id === "target")
          ?.blocks.map((item) => item.id)
      ).toEqual(y <= 128 ? ["first", "drag"] : ["drag", "first"])
    }
  )
})

describe("release pointer", () => {
  it.each([100, 114, 128])(
    "uses the release at y=%s even when the last move was on a block",
    async (y) => {
      vi.stubGlobal("PointerEvent", MouseEvent)
      const document: CvBlockDocument = {
        version: 2,
        header: { name: "", email: "", phone: "", city: "", linkedin: "" },
        sections: [
          {
            id: "source",
            kind: "experience",
            blocks: [{ id: "drag", type: "text", text: "Move" }],
          },
          {
            id: "target",
            kind: "activities",
            blocks: [{ id: "first", type: "text", text: "Stay" }],
          },
        ],
      }
      const commit = vi.fn()
      render(
        <PaperBlocks
          document={document}
          onChange={vi.fn()}
          onCommit={commit}
          onAskCoach={vi.fn()}
        />
      )
      const heading = screen.getByRole("heading", { name: "Activities" })
      const source = screen
        .getAllByRole("textbox", { name: "Text" })[0]!
        .closest<HTMLElement>("[data-sortable-block]")!
      vi.spyOn(
        HTMLElement.prototype,
        "getBoundingClientRect"
      ).mockImplementation(function (this: HTMLElement) {
        if (this === heading) return rect(100, 28)
        if (this.dataset.sortableBlock === "drag") return rect(0, 80)
        return rect(132, 80)
      })
      const handle = source.querySelector("button")!
      fireEvent.mouseDown(handle, { button: 0, clientX: 20, clientY: 20 })
      fireEvent.mouseMove(window.document, { clientX: 40, clientY: 40 })
      await act(async () => {})
      fireEvent.mouseMove(window.document, { clientX: 120, clientY: 140 })
      await act(async () => {})
      fireEvent.pointerUp(heading, { clientX: 120, clientY: y })
      fireEvent.mouseUp(window.document, { clientX: 120, clientY: y })
      expect(commit).toHaveBeenCalledTimes(1)
      const next: CvBlockDocument = commit.mock.calls[0]![0]
      expect(
        next.sections.find((s) => s.id === "target")?.blocks.map((b) => b.id)
      ).toEqual(y <= 128 ? ["first", "drag"] : ["drag", "first"])
    }
  )
})
