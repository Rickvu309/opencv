import "@testing-library/jest-dom/vitest"
import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog"

afterEach(cleanup)

function Outside() {
  return (
    <>
      <a href="#main">Skip to main content</a>
      <button type="button">Search</button>
    </>
  )
}

function KitConfirm({ onKeyDown }: { onKeyDown?: () => void }) {
  return (
    <>
      <Outside />
      <Dialog open>
        <DialogContent onKeyDown={onKeyDown}>
          <DialogTitle>Delete this CV?</DialogTitle>
          <DialogDescription>This can't be undone.</DialogDescription>
          <button type="button">Cancel</button>
          <button type="button">Delete</button>
        </DialogContent>
      </Dialog>
    </>
  )
}

function PrimitiveConfirm() {
  return (
    <>
      <Outside />
      <DialogPrimitive.Root open>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Popup>
            <DialogPrimitive.Title>Delete this CV?</DialogPrimitive.Title>
            <button type="button">Cancel</button>
            <button type="button">Delete</button>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}

async function tabCycle(backwards: boolean) {
  const user = userEvent.setup()
  const dialog = await screen.findByRole("dialog")
  await waitFor(() =>
    expect(dialog.contains(document.activeElement)).toBe(true)
  )
  const stops = dialog.querySelectorAll("button").length
  const visits: string[] = []
  for (let press = 0; press < stops * 2 + 2; press += 1) {
    await user.tab({ shift: backwards })
    const active = document.activeElement
    visits.push(
      dialog.contains(active)
        ? `inside ${active?.textContent ?? ""}`
        : `outside ${active?.tagName ?? ""}`
    )
  }
  return visits
}

const escaped = (visits: string[]) =>
  visits.filter((visit) => visit.startsWith("outside"))

describe("a kit dialog keeps Tab inside", () => {
  it.each([false, true])(
    "cycles every stop and never leaves, backwards %s",
    async (backwards) => {
      render(<KitConfirm />)
      expect(await screen.findByRole("dialog")).toBe(
        document.querySelector('[data-slot="dialog-content"]')
      )
      const visits = await tabCycle(backwards)
      expect(visits.join(" | ")).not.toContain("outside")
      expect(new Set(visits)).toEqual(
        new Set(["inside Cancel", "inside Delete", "inside Close"])
      )
    }
  )

  it("still runs the caller's key handler", async () => {
    const onKeyDown = vi.fn()
    render(<KitConfirm onKeyDown={onKeyDown} />)
    await tabCycle(false)
    expect(onKeyDown).toHaveBeenCalled()
  })

  it("lets Tab escape a dialog that skips the kit, which is the mistake this guards", async () => {
    render(<PrimitiveConfirm />)
    expect(escaped(await tabCycle(false))).not.toEqual([])
  })
})

function KitRename({ chooseDelete }: { chooseDelete?: boolean }) {
  const deleteRef = React.useRef<HTMLButtonElement>(null)
  return (
    <Dialog open>
      <DialogContent initialFocus={chooseDelete ? deleteRef : undefined}>
        <DialogTitle>Rename this CV</DialogTitle>
        <button type="button">Cancel</button>
        <input aria-label="Name" />
        <button type="button" ref={deleteRef}>
          Delete
        </button>
      </DialogContent>
    </Dialog>
  )
}

describe("a kit dialog opens without lighting up a button", () => {
  it("rests focus on the dialog itself when it has no text field", async () => {
    render(<KitConfirm />)
    const dialog = await screen.findByRole("dialog")
    await waitFor(() => expect(document.activeElement).toBe(dialog))
    await userEvent.setup().tab()
    expect(document.activeElement).toHaveTextContent("Cancel")
  })

  it("puts the caret in the first text field", async () => {
    render(<KitRename />)
    const name = await screen.findByRole("textbox", { name: "Name" })
    await waitFor(() => expect(document.activeElement).toBe(name))
  })

  it("still honours the element a caller picks", async () => {
    render(<KitRename chooseDelete />)
    const remove = await screen.findByRole("button", { name: "Delete" })
    await waitFor(() => expect(document.activeElement).toBe(remove))
  })
})
