import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  cleanup()
})

vi.mock("sonner", () => ({
  toast: vi.fn(() => "toast-id"),
  Toaster: () => null,
}))

import { Brand } from "./components/brand"
import { Button } from "./components/button"
import { ConfirmDelete } from "./components/confirm-delete"
import { Field } from "./components/field"
import { Input } from "./components/input"
import { Meter } from "./components/meter"
import { PageHeader } from "./components/page-header"
import { StageIcon } from "./components/stage-icon"
import { Toolbar } from "./components/toolbar"
import { UsageBar } from "./components/usage-bar"
import { toastWithUndo } from "./components/sonner"
import { toast } from "sonner"

describe("kit parts", () => {
  it("links the field label to the input and announces the error", () => {
    render(
      <Field label="Role" error="Add the role title to save this job.">
        <Input />
      </Field>
    )
    const input = screen.getByLabelText("Role")
    expect(input).toHaveAttribute("aria-invalid", "true")
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Add the role title to save this job.")
    expect(input).toHaveAttribute("aria-describedby", alert.id)
  })

  it("confirms a delete, then closes", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(
      <ConfirmDelete
        open
        thing="Associate PM intern"
        confirmLabel="Delete job"
        onConfirm={onConfirm}
        onClose={onClose}
      />
    )
    expect(
      screen.getByRole("heading", { name: "Delete Associate PM intern?" })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Delete job" }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("exposes usage as a percentage on the meter", () => {
    render(<Meter label="This week" value={0.52} />)
    const meter = screen.getByRole("meter", { name: "This week" })
    expect(meter).toHaveAttribute("aria-valuenow", "52")
    expect(screen.getByText("52% used")).toBeInTheDocument()
  })

  it("exposes the usage bar as a percentage", () => {
    render(<UsageBar label="Current session" value={0.34} />)
    expect(
      screen.getByRole("meter", { name: "Current session" })
    ).toHaveAttribute("aria-valuenow", "34")
  })

  it("writes the brand as the mark plus lowercase opencv", () => {
    render(<Brand lead="Log in to" />)
    expect(screen.getByText("opencv")).toBeInTheDocument()
    expect(screen.getByText("Log in to")).toBeInTheDocument()
    expect(document.querySelector("[data-slot=mark]")).toBeTruthy()
  })

  it("names the stage icon", () => {
    render(<StageIcon stage="interview" />)
    expect(screen.getByRole("img", { name: "Interview" })).toBeInTheDocument()
  })

  it("gives the glow variant and the default primary the glow utility", () => {
    const { rerender } = render(<Button variant="glow">Add job</Button>)
    expect(screen.getByRole("button", { name: "Add job" }).className).toMatch(
      /\bglow\b/
    )
    rerender(<Button>Add job</Button>)
    expect(screen.getByRole("button", { name: "Add job" }).className).toMatch(
      /\bglow\b/
    )
  })

  it("renders a page header and a toolbar of links", () => {
    render(
      <>
        <PageHeader title="Apply" />
        <Toolbar
          active="/apply"
          tabs={[
            { label: "Board", href: "/apply" },
            { label: "List", href: "/apply/list" },
          ]}
        />
      </>
    )
    expect(screen.getByRole("heading", { name: "Apply" })).toBeInTheDocument()
    const board = screen.getByRole("button", { name: "Board" })
    expect(board.tagName).toBe("A")
    expect(board).toHaveAttribute("href", "/apply")
    expect(board).toHaveAttribute("aria-current", "page")
  })

  it("sends Undo as the toast action", () => {
    const onUndo = vi.fn()
    toastWithUndo("Job deleted", onUndo)
    expect(toast).toHaveBeenCalledWith("Job deleted", {
      action: { label: "Undo", onClick: onUndo },
    })
  })
})
