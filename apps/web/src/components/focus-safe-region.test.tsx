import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { FocusSafeRegion } from "@/components/focus-safe-region.tsx"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

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

  it("closes a tooltip that was open on a control inside when the region hides", async () => {
    const view = render(<TooltipShell concealed={false} />)
    const trigger = screen.getByRole("button", { name: "Collapse" })
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" })
    fireEvent.mouseEnter(trigger)
    fireEvent.mouseMove(trigger)
    await screen.findByText("Collapse sidebar")
    view.rerender(<TooltipShell concealed />)
    await act(async () => undefined)
    expect(screen.queryByText("Collapse sidebar")).toBeNull()
  })

  it("closes a popover that was open inside when the region hides", async () => {
    const view = render(<PopoverShell concealed={false} />)
    fireEvent.click(screen.getByRole("button", { name: "Account" }))
    await screen.findByText("Sign out")
    view.rerender(<PopoverShell concealed />)
    await act(async () => undefined)
    expect(screen.queryByText("Sign out")).toBeNull()
  })

  it("does not leave the fallback's tooltip open after the hand-off", async () => {
    const view = render(<FallbackShell concealed={false} />)
    fireEvent.keyDown(document.body, { key: "Tab" })
    screen.getByText("Collapse").focus()
    view.rerender(<FallbackShell concealed />)
    expect(document.activeElement).toBe(screen.getByText("Expand"))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(screen.queryByText("Expand sidebar")).toBeNull()
  })

  it("leaves a tooltip open that belongs to a control outside the region", async () => {
    const view = render(<TooltipShell concealed={false} />)
    const outside = screen.getByRole("button", { name: "Expand" })
    fireEvent.pointerEnter(outside, { pointerType: "mouse" })
    fireEvent.mouseEnter(outside)
    fireEvent.mouseMove(outside)
    await screen.findByText("Expand sidebar")
    view.rerender(<TooltipShell concealed />)
    await act(async () => undefined)
    expect(screen.queryByText("Expand sidebar")).not.toBeNull()
  })
})

function FallbackShell({ concealed }: { concealed: boolean }) {
  return (
    <div>
      <FocusSafeRegion
        as="aside"
        concealed={concealed}
        focusFallback={() => screen.queryByRole("button", { name: "Expand" })}
      >
        <button>Collapse</button>
      </FocusSafeRegion>
      <Tooltip>
        <TooltipTrigger render={<button>Expand</button>} />
        <TooltipContent>Expand sidebar</TooltipContent>
      </Tooltip>
    </div>
  )
}

function TooltipShell({ concealed }: { concealed: boolean }) {
  return (
    <div>
      <FocusSafeRegion
        as="aside"
        concealed={concealed}
        focusFallback={() => null}
      >
        <Tooltip>
          <TooltipTrigger render={<button>Collapse</button>} />
          <TooltipContent>Collapse sidebar</TooltipContent>
        </Tooltip>
      </FocusSafeRegion>
      <Tooltip>
        <TooltipTrigger render={<button>Expand</button>} />
        <TooltipContent>Expand sidebar</TooltipContent>
      </Tooltip>
    </div>
  )
}

function PopoverShell({ concealed }: { concealed: boolean }) {
  return (
    <FocusSafeRegion
      as="aside"
      concealed={concealed}
      focusFallback={() => null}
    >
      <Popover>
        <PopoverTrigger render={<button>Account</button>} />
        <PopoverContent>Sign out</PopoverContent>
      </Popover>
    </FocusSafeRegion>
  )
}
