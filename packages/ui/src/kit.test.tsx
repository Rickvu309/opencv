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
import { CodeBlockLine } from "./components/code-block"
import { Skeleton as ShimmerSkeleton } from "./components/shimmer-loader"
import { CopyButton } from "./components/copy-button"
import { ConfirmDelete } from "./components/confirm-delete"
import { Field } from "./components/field"
import { Input } from "./components/input"
import { Meter } from "./components/meter"
import { Spinner } from "./components/spinner"
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

  it("closes ConfirmDelete when Escape is pressed", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <ConfirmDelete
        open
        thing="Associate PM intern"
        confirmLabel="Delete job"
        onConfirm={vi.fn()}
        onClose={onClose}
      />
    )
    await user.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalled()
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

  it("hides a decorative stage icon so the written stage name is heard once", () => {
    render(
      <p>
        <StageIcon stage="applied" decorative />
        Applied
      </p>
    )
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.getByText("Applied")).toHaveTextContent(/^Applied$/)
  })

  it("offers no glow variant: the main action is the solid primary and the default stays the kit secondary", () => {
    const { rerender } = render(<Button variant="primary">Add job</Button>)
    const primary = screen.getByRole("button", { name: "Add job" })
    expect(primary).toHaveAttribute("data-variant", "primary")
    expect(primary.className).toMatch(/\bbg-primary\b/)
    expect(primary.className).not.toMatch(/\bglow\b|radial-gradient/)
    rerender(<Button>Add job</Button>)
    const secondary = screen.getByRole("button", { name: "Add job" })
    expect(secondary).toHaveAttribute("data-variant", "default")
    expect(secondary.className).not.toMatch(/\bglow\b/)
  })

  it("holds a newline in an empty code line so copying keeps blank lines", () => {
    const { container } = render(
      <>
        <CodeBlockLine />
        <CodeBlockLine>x</CodeBlockLine>
      </>
    )
    const [blank, filled] = container.querySelectorAll(
      "[data-slot=code-block-line-content]"
    )
    expect(blank.textContent).toBe("\n")
    expect(filled.textContent).toBe("x")
  })

  it("pins every shimmer skeleton to the viewport so they share one sweep", () => {
    render(<ShimmerSkeleton />)
    expect(document.head.textContent).toContain("background-attachment: fixed")
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
    const board = screen.getByRole("link", { name: "Board" })
    expect(board.tagName).toBe("A")
    expect(board).toHaveAttribute("href", "/apply")
    expect(board).toHaveAttribute("aria-current", "page")
    expect(board).not.toHaveAttribute("role", "button")
  })

  it("sends Undo as the toast action, led by an icon", () => {
    const onUndo = vi.fn()
    toastWithUndo("Job deleted", onUndo)
    expect(toast).toHaveBeenCalledWith("Job deleted", {
      icon: expect.anything(),
      action: { label: "Undo", onClick: onUndo },
    })
  })

  describe("copy button", () => {
    function mockClipboard(writeText: (text: string) => Promise<void>) {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      })
    }

    it("copies the text and says it was copied", async () => {
      const user = userEvent.setup()
      const writeText = vi.fn(() => Promise.resolve())
      mockClipboard(writeText)
      vi.mocked(toast).mockClear()
      render(<CopyButton value="https://opencv.me/s/abc" aria-label="Copy" />)
      await user.click(screen.getByRole("button", { name: "Copy" }))
      expect(writeText).toHaveBeenCalledWith("https://opencv.me/s/abc")
      expect(toast).toHaveBeenCalledWith("Copied")
      expect(screen.getByRole("button", { name: "Copy" })).toHaveAttribute(
        "data-state",
        "copied"
      )
    })

    it("waits for an async value and uses its own message", async () => {
      const user = userEvent.setup()
      const writeText = vi.fn(() => Promise.resolve())
      mockClipboard(writeText)
      vi.mocked(toast).mockClear()
      render(
        <CopyButton
          value={async () => "from-server"}
          copiedMessage="Link copied"
          aria-label="Copy link"
        />
      )
      await user.click(screen.getByRole("button", { name: "Copy link" }))
      expect(writeText).toHaveBeenCalledWith("from-server")
      expect(toast).toHaveBeenCalledWith("Link copied")
    })

    it("shows the error from the value source", async () => {
      const user = userEvent.setup()
      const writeText = vi.fn(() => Promise.resolve())
      mockClipboard(writeText)
      vi.mocked(toast).mockClear()
      render(
        <CopyButton
          value={async () => {
            throw new Error("Sign in again.")
          }}
          errorMessage={(error) =>
            error instanceof Error ? error.message : "Could not copy."
          }
          aria-label="Copy link"
        />
      )
      await user.click(screen.getByRole("button", { name: "Copy link" }))
      expect(writeText).not.toHaveBeenCalled()
      expect(toast).toHaveBeenCalledWith("Sign in again.")
      expect(screen.getByRole("button", { name: "Copy link" })).toHaveAttribute(
        "data-state",
        "idle"
      )
    })

    it("shows the default error when the clipboard and fallback both fail", async () => {
      const user = userEvent.setup()
      mockClipboard(() => Promise.reject(new Error("denied")))
      vi.mocked(toast).mockClear()
      render(<CopyButton value="text" aria-label="Copy" />)
      await user.click(screen.getByRole("button", { name: "Copy" }))
      expect(toast).toHaveBeenCalledWith("Could not copy. Try again.")
    })

    it("ignores a second click while the value is loading", async () => {
      const user = userEvent.setup()
      mockClipboard(() => Promise.resolve())
      let release: (text: string) => void = () => {}
      const value = vi.fn(
        () => new Promise<string>((resolve) => (release = resolve))
      )
      render(<CopyButton value={value} aria-label="Copy link" />)
      const button = screen.getByRole("button", { name: "Copy link" })
      await user.click(button)
      await user.click(button)
      expect(value).toHaveBeenCalledOnce()
      expect(button).toHaveAttribute("data-state", "pending")
      release("done")
      await screen.findByRole("button", { name: "Copy link" })
      await vi.waitFor(() =>
        expect(button).toHaveAttribute("data-state", "copied")
      )
    })
  })

  it("names the spinner as a loading status", () => {
    render(<Spinner />)
    expect(screen.getByRole("status", { name: "Loading" })).toHaveAttribute(
      "data-slot",
      "spinner"
    )
  })

  it("hides a decorative spinner from assistive tech", () => {
    const { container } = render(<Spinner aria-hidden="true" />)
    expect(screen.queryByRole("status")).toBeNull()
    expect(container.querySelector('[data-slot="spinner"]')).toHaveAttribute(
      "aria-hidden",
      "true"
    )
  })
})
