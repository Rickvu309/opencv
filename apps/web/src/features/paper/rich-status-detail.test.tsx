import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { useRichStatusDetail } from "./rich-status-detail.ts"

function Status({ label, saved = false }: { label: string; saved?: boolean }) {
  const {
    statusRef,
    detailRef,
    visible: statusDetailVisible,
    minHeight: statusDetailHeight,
  } = useRichStatusDetail(label, saved)
  return (
    <header>
      <span ref={statusRef} role="status">
        {label}
      </span>
      {statusDetailVisible ? (
        <p
          aria-hidden="true"
          ref={detailRef}
          style={{ minHeight: statusDetailHeight }}
        >
          {label}
        </p>
      ) : null}
    </header>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function widths(clipped: boolean) {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(
    clipped ? 160 : 100
  )
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100)
}

it("keeps the full status during alternating Saving and Offline until Saved", () => {
  widths(true)
  const view = render(<Status label="Offline, retrying" />)
  expect(screen.getByRole("status")).toHaveTextContent("Offline, retrying")
  for (const label of [
    "Saving…",
    "Offline, retrying",
    "Saving…",
    "Offline, retrying",
  ]) {
    view.rerender(<Status label={label} />)
    expect(screen.getByRole("status")).toHaveTextContent(label)
    expect(view.container.querySelector("p")).toHaveAttribute(
      "aria-hidden",
      "true"
    )
    expect(screen.getAllByRole("status")).toHaveLength(1)
  }
  view.rerender(<Status label="Saved" saved />)
  expect(screen.getByRole("status")).toHaveTextContent("Saved")
  expect(view.container.querySelector("p")).not.toBeInTheDocument()
})

it("does not show a second status when the header text fits", () => {
  widths(false)
  const view = render(<Status label="Offline, retrying" />)
  for (const label of ["Saving…", "Offline, retrying", "Saved"]) {
    view.rerender(<Status label={label} saved={label === "Saved"} />)
    expect(screen.getAllByRole("status")).toHaveLength(1)
    expect(view.container.querySelector("p")).not.toBeInTheDocument()
    expect(screen.getByText(label)).toBeVisible()
  }
})

it("keeps the same exposed live region from first render through status changes", () => {
  widths(false)
  const view = render(<Status label="Loading…" />)
  const region = screen.getByRole("status")
  for (const label of ["Saving…", "Offline, retrying", "Saved"]) {
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(160)
    view.rerender(<Status label={label} saved={label === "Saved"} />)
    expect(screen.getAllByRole("status")).toEqual([region])
    expect(region).toHaveTextContent(label)
    expect(region).not.toHaveAttribute("aria-hidden")
    if (label !== "Saved") {
      expect(view.container.querySelector("p")).toHaveAttribute(
        "aria-hidden",
        "true"
      )
      expect(view.container.querySelector("p")).not.toHaveAttribute("role")
    }
  }
})

it.each(["viewport", "text"])(
  "clears the detail on a %s resize when the status fits again",
  (change) => {
    const notify = () => window.dispatchEvent(new Event("resize"))
    widths(true)
    const view = render(<Status label="Offline, retrying" />)
    expect(view.container.querySelector("p")).toBeInTheDocument()
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(80)
    view.rerender(<Status label="Saving…" />)
    act(() => notify())
    expect(view.container.querySelector("p")).toBeInTheDocument()
    const header = view.container.querySelector("header")
    if (!header) throw new Error("Missing header")
    if (change === "viewport") {
      vi.spyOn(header, "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 0, 1440, 52)
      )
    } else {
      screen.getByRole("status").style.fontSize = "14px"
    }
    act(() => notify())
    expect(view.container.querySelector("p")).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Saving…")
  }
)
