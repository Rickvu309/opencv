import { cleanup, render, screen } from "@testing-library/react"
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
    <>
      <span ref={statusRef} aria-hidden={statusDetailVisible}>
        {label}
      </span>
      {statusDetailVisible ? (
        <p
          role="status"
          ref={detailRef}
          style={{ minHeight: statusDetailHeight }}
        >
          {label}
        </p>
      ) : null}
    </>
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
    expect(view.container.querySelector("span")).toHaveAttribute(
      "aria-hidden",
      "true"
    )
  }
  view.rerender(<Status label="Saved" saved />)
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
})

it("does not show a second status when the header text fits", () => {
  widths(false)
  const view = render(<Status label="Offline, retrying" />)
  for (const label of ["Saving…", "Offline, retrying", "Saved"]) {
    view.rerender(<Status label={label} saved={label === "Saved"} />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.getByText(label)).toBeVisible()
  }
})
