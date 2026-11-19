import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Button } from "./components/button"

afterEach(cleanup)

const classesOf = (element: HTMLElement) => element.className.split(/\s+/)

describe("button", () => {
  it("paints the primary variant as the solid main action of the confirm dialog", () => {
    render(<Button variant="primary">Approve</Button>)
    const button = screen.getByRole("button", { name: "Approve" })
    expect(button).toHaveAttribute("data-variant", "primary")
    expect(classesOf(button)).toEqual(
      expect.arrayContaining([
        "bg-primary",
        "text-primary-foreground",
        "text-ui",
        "font-semibold",
        "h-8",
        "px-3",
        "rounded-md",
      ])
    )
    for (const replaced of [
      "text-sm",
      "font-medium",
      "px-2.5",
      "rounded-lg",
      "glow",
    ])
      expect(classesOf(button)).not.toContain(replaced)
    expect(button.className).not.toContain("ring-border")
  })

  it("keeps the default variant as the outlined secondary action", () => {
    render(<Button>Deny</Button>)
    const button = screen.getByRole("button", { name: "Deny" })
    expect(button).toHaveAttribute("data-variant", "default")
    expect(classesOf(button)).toEqual(
      expect.arrayContaining(["bg-card", "ring-1", "ring-border"])
    )
    expect(classesOf(button)).not.toContain("bg-primary")
  })

  it("presses with the shared press motion and does not nudge by a pixel", () => {
    render(<Button>Save</Button>)
    const button = screen.getByRole("button", { name: "Save" })
    expect(classesOf(button)).toContain("motion-press")
    expect(classesOf(button)).not.toContain("transition-all")
    expect(button.className).not.toContain("translate-y-px")
  })
})
