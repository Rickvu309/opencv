import type { ComponentProps } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { CoachPanel } from "./coach-panel"
import snapshot from "./design/coach-panel.snapshot.json"

afterEach(cleanup)

describe("Coach panel", () => {
  it("shows the source title and preserves the conversation on expansion", () => {
    const title = snapshot.sections[0].texts[0]
    const props = {
      title,
      open: true,
      mode: "side",
      onMinimize: vi.fn(),
      onExpand: vi.fn(),
      onClose: vi.fn(),
    } satisfies ComponentProps<typeof CoachPanel>
    const { rerender } = render(
      <CoachPanel {...props}>
        <p>Saved conversation</p>
      </CoachPanel>
    )
    expect(screen.getByRole("region", { name: title })).toBeVisible()
    expect(screen.getByRole("button", { name: "Expand" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    rerender(
      <CoachPanel {...props} mode="full">
        <p>Saved conversation</p>
      </CoachPanel>
    )
    expect(screen.getByText("Saved conversation")).toBeVisible()
    expect(screen.getByRole("button", { name: "Expand" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  it("routes each panel control to its own action", () => {
    const onMinimize = vi.fn()
    const onExpand = vi.fn()
    const onClose = vi.fn()
    render(
      <CoachPanel
        title="Tailor CV"
        open
        mode="side"
        onMinimize={onMinimize}
        onExpand={onExpand}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Minimize" }))
    expect(onMinimize).toHaveBeenCalledOnce()
    expect(onExpand).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Expand" }))
    expect(onExpand).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("unmounts its controls and conversation when closed", () => {
    render(
      <CoachPanel
        title="Tailor CV"
        open={false}
        mode="side"
        onMinimize={vi.fn()}
        onExpand={vi.fn()}
        onClose={vi.fn()}
      >
        <p>Saved conversation</p>
      </CoachPanel>
    )
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
    expect(screen.queryByText("Saved conversation")).not.toBeInTheDocument()
  })
})
