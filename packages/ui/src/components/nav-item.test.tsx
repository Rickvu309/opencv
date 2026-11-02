import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { FOCUS_RING } from "../lib/focus-ring"
import { NavItem, NavItemBadge } from "./nav-item"

afterEach(cleanup)

describe("nav item", () => {
  it("renders a link by default", () => {
    render(<NavItem href="/inbox">Inbox</NavItem>)
    const link = screen.getByRole("link", { name: "Inbox" })
    expect(link.tagName).toBe("A")
    expect(link).toHaveAttribute("href", "/inbox")
  })

  it("renders the element given through render", () => {
    render(
      <NavItem render={<button type="button" />} data-testid="item">
        Open
      </NavItem>
    )
    const item = screen.getByTestId("item")
    expect(item.tagName).toBe("BUTTON")
    expect(item).toHaveTextContent("Open")
    expect(item).toHaveAttribute("data-slot", "nav-item")
  })

  it("marks the current page only when active", () => {
    const { rerender } = render(<NavItem href="/a">A</NavItem>)
    expect(screen.getByRole("link")).not.toHaveAttribute("aria-current")
    rerender(
      <NavItem href="/a" active>
        A
      </NavItem>
    )
    expect(screen.getByRole("link")).toHaveAttribute("aria-current", "page")
  })

  it("lets a caller aria-current win over active", () => {
    render(
      <NavItem href="/a" active aria-current="location">
        A
      </NavItem>
    )
    expect(screen.getByRole("link")).toHaveAttribute("aria-current", "location")
  })

  it("carries the slot, the tone and the focus ring", () => {
    const { rerender } = render(<NavItem href="/a">A</NavItem>)
    const link = screen.getByRole("link")
    expect(link).toHaveAttribute("data-slot", "nav-item")
    expect(link).toHaveAttribute("data-tone", "sidebar")
    for (const part of FOCUS_RING.split(" ")) expect(link).toHaveClass(part)
    rerender(
      <NavItem href="/a" tone="muted">
        A
      </NavItem>
    )
    expect(screen.getByRole("link")).toHaveAttribute("data-tone", "muted")
  })

  it("hides the badge from assistive technology", () => {
    render(<NavItemBadge>3</NavItemBadge>)
    const badge = document.querySelector("[data-slot=nav-item-badge]")
    expect(badge).toHaveTextContent("3")
    expect(badge).toHaveAttribute("aria-hidden", "true")
  })
})
