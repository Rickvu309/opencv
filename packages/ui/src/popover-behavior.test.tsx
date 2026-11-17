import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { checkPattern } from "@ui-sdk/core/testing"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "./components/popover"
import { Button } from "./components/button"

afterEach(cleanup)

function Editor({
  initialFocus,
  finalFocus,
  onOpenChange,
  modal,
}: Pick<
  React.ComponentProps<typeof PopoverContent>,
  "initialFocus" | "finalFocus"
> &
  Pick<React.ComponentProps<typeof Popover>, "onOpenChange" | "modal">) {
  return (
    <>
      <button>Outside</button>
      <Popover onOpenChange={onOpenChange} modal={modal}>
        <PopoverTrigger render={<Button />}>Edit</PopoverTrigger>
        <PopoverContent initialFocus={initialFocus} finalFocus={finalFocus}>
          <PopoverTitle>Edit Job</PopoverTitle>
          <PopoverDescription>Change the location.</PopoverDescription>
          <input aria-label="Location" />
          <button>Save</button>
        </PopoverContent>
      </Popover>
    </>
  )
}

async function open() {
  fireEvent.click(screen.getByRole("button", { name: "Edit" }))
  return screen.findByRole("dialog", { name: "Edit Job" })
}

describe("the kit popover behavior adapter", () => {
  it("enters the first field and restores the trigger after Escape", async () => {
    render(<Editor />)
    await open()
    expect(
      screen
        .getByRole("button", { name: "Edit" })
        .hasAttribute("data-popup-open")
    ).toBe(true)
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Location"))
    )
    fireEvent.keyDown(document.activeElement!, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Edit" })
    )
  })

  it("preserves the editor callback and reports the closing interaction", async () => {
    const finalFocus = vi.fn(() => {
      screen.getByRole("button", { name: "Outside" }).focus()
      return false
    })
    render(<Editor finalFocus={finalFocus} />)
    await open()
    fireEvent.keyDown(screen.getByLabelText("Location"), { key: "Escape" })
    await waitFor(() => expect(finalFocus).toHaveBeenCalledWith("keyboard"))
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Outside" })
    )
  })

  it("resolves initial and final focus refs without changing callers", async () => {
    const target = React.createRef<HTMLButtonElement>()
    render(
      <>
        <button ref={target}>Target</button>
        <Editor initialFocus={target} finalFocus={target} />
      </>
    )
    await open()
    await waitFor(() => expect(document.activeElement).toBe(target.current))
    fireEvent.keyDown(target.current!, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(document.activeElement).toBe(target.current)
  })

  it("leaves focus in place when initialFocus is false", async () => {
    render(<Editor initialFocus={false} />)
    screen.getByRole("button", { name: "Outside" }).focus()
    await open()
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Outside" })
    )
  })

  it("closes after an outside click", async () => {
    render(<Editor />)
    await open()
    const outside = screen.getByRole("button", { name: "Outside" })
    fireEvent.pointerDown(outside, { pointerType: "mouse" })
    fireEvent.click(outside)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("honors cancellation and the outside-press reason", async () => {
    const onOpenChange = vi.fn((open, details) => {
      if (!open) details.cancel()
    })
    render(<Editor onOpenChange={onOpenChange} />)
    await open()
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }), {
      pointerType: "mouse",
    })
    fireEvent.click(screen.getByRole("button", { name: "Outside" }))
    await waitFor(() =>
      expect(onOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: "outside-press" })
      )
    )
    expect(screen.getByRole("dialog")).toBeTruthy()
  })

  it("passes the UI SDK WAI-ARIA dialog pattern check", async () => {
    render(<Editor modal />)
    const dialog = await open()
    await act(async () => {
      await checkPattern(dialog, "dialog")
    })
  })
})
