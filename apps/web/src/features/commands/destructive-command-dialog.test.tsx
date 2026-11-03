import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DestructiveCommandDialog } from "./destructive-command-dialog.tsx"

afterEach(() => {
  cleanup()
})

function renderOpenDialog() {
  const onConfirm = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <DestructiveCommandDialog
      open
      title="Delete job"
      name="Acme"
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  )
  return { onConfirm, onOpenChange }
}

describe("DestructiveCommandDialog", () => {
  it("runs the Command only from Delete, then closes", () => {
    const { onConfirm, onOpenChange } = renderOpenDialog()
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("does not run the Command on Cancel", () => {
    const { onConfirm, onOpenChange } = renderOpenDialog()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("does not run the Command when the dialog is dismissed with Escape", () => {
    const { onConfirm, onOpenChange } = renderOpenDialog()
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
  })
})
