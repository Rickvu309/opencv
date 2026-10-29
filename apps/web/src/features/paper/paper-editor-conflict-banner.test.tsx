import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { PaperEditorConflictBanner } from "./paper-editor-conflict-banner.tsx"

describe("PaperEditorConflictBanner", () => {
  it("exposes the conflict message as an alert live region", () => {
    const onReload = vi.fn()

    render(<PaperEditorConflictBanner onReload={onReload} />)

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This document changed. Reload it and try again."
    )
    fireEvent.click(screen.getByRole("button", { name: "Reload" }))
    expect(onReload).toHaveBeenCalledOnce()
  })
})
