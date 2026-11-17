import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { WorkspaceHeader } from "@/components/workspace-header.tsx"
import { SidebarExpandContext } from "@workspace/ui/components/page-header"

afterEach(cleanup)

function renderHeader(collapsed: boolean, expand = () => {}) {
  render(
    <SidebarExpandContext value={{ collapsed, expand }}>
      <WorkspaceHeader title="Jobs" />
    </SidebarExpandContext>
  )
}

describe("WorkspaceHeader", () => {
  it("shows no expand icon while the sidebar is open", () => {
    renderHeader(false)
    expect(
      screen.queryByRole("button", { name: "Expand sidebar" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Jobs" })).toBeInTheDocument()
  })

  it("puts the expand icon before the title when the sidebar is collapsed", () => {
    renderHeader(true)
    const icon = screen.getByRole("button", { name: "Expand sidebar" })
    const title = screen.getByRole("heading", { name: "Jobs" })
    expect(
      icon.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(icon).toHaveAttribute("data-slot", "sidebar-expand")
    expect(icon).toHaveClass("max-md:hidden")
  })

  it("expands the sidebar on click", async () => {
    const expand = vi.fn()
    renderHeader(true, expand)
    await userEvent.click(
      screen.getByRole("button", { name: "Expand sidebar" })
    )
    expect(expand).toHaveBeenCalledTimes(1)
  })
})
