import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { FocusSafeRegion } from "@/components/focus-safe-region.tsx"

function Shell({ concealed }: { concealed: boolean }) {
  return (
    <div>
      <FocusSafeRegion
        as="aside"
        aria-label="Sidebar"
        concealed={concealed}
        focusFallback={() => screen.queryByRole("button", { name: "Expand" })}
      >
        <button>Collapse</button>
      </FocusSafeRegion>
      <button>Expand</button>
      <button>Elsewhere</button>
    </div>
  )
}

describe("FocusSafeRegion", () => {
  it("moves focus to the fallback when the region hides around it", () => {
    const view = render(<Shell concealed={false} />)
    screen.getByText("Collapse").focus()
    view.rerender(<Shell concealed />)
    expect(document.activeElement).toBe(screen.getByText("Expand"))
    expect(screen.getByLabelText("Sidebar").hasAttribute("inert")).toBe(true)
  })

  it("leaves focus alone when it was outside the region", () => {
    const view = render(<Shell concealed={false} />)
    screen.getByText("Elsewhere").focus()
    view.rerender(<Shell concealed />)
    expect(document.activeElement).toBe(screen.getByText("Elsewhere"))
  })

  it("makes the region interactive again when it shows", () => {
    const view = render(<Shell concealed />)
    view.rerender(<Shell concealed={false} />)
    expect(screen.getByLabelText("Sidebar").hasAttribute("inert")).toBe(false)
  })
})
