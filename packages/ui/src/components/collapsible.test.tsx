import "@testing-library/jest-dom/vitest"
import { useState } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "./collapsible"

afterEach(cleanup)

function Section({
  keepMounted,
  defaultOpen,
}: {
  keepMounted?: boolean
  defaultOpen?: boolean
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger>
        Work
        <CollapsibleIndicator />
      </CollapsibleTrigger>
      <CollapsibleContent keepMounted={keepMounted}>Body</CollapsibleContent>
    </Collapsible>
  )
}

function Controlled() {
  const [open, setOpen] = useState(true)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger>Work</CollapsibleTrigger>
      <CollapsibleContent>Body</CollapsibleContent>
    </Collapsible>
  )
}

function indicator() {
  return document.querySelector("[data-slot=collapsible-indicator]")
}

describe("collapsible", () => {
  it("flips aria-expanded when the trigger is clicked", async () => {
    render(<Section />)
    const trigger = screen.getByRole("button", { name: "Work" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("points aria-controls at the panel", () => {
    render(<Section defaultOpen />)
    const trigger = screen.getByRole("button", { name: "Work" })
    const panel = document.querySelector("[data-slot=collapsible-content]")
    expect(panel).not.toBeNull()
    expect(trigger.getAttribute("aria-controls")).toBe(panel?.id)
  })

  it("unmounts a closed panel unless keepMounted is set", () => {
    const { unmount } = render(<Section />)
    expect(screen.queryByText("Body")).toBeNull()
    unmount()
    render(<Section keepMounted />)
    expect(screen.getByText("Body", { hidden: true })).not.toBeVisible()
  })

  it("rotates the indicator only while closed", async () => {
    render(<Section />)
    expect(indicator()).toHaveClass(
      "-rotate-90",
      "group-data-[panel-open]/collapsible-trigger:rotate-0"
    )
    const trigger = screen.getByRole("button", { name: "Work" })
    expect(trigger).not.toHaveAttribute("data-panel-open")
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("data-panel-open")
  })

  it("animates a box with no layout of its own and gives the caller's layout to the body", () => {
    render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Work</CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-1">
          <span>One</span>
          <span>Two</span>
        </CollapsibleContent>
      </Collapsible>
    )
    const panel = document.querySelector("[data-slot=collapsible-content]")
    expect(panel?.className).toBe("motion-collapse")
    const body = panel?.querySelector(":scope > [data-slot=collapsible-body]")
    expect(body?.className.split(/\s+/)).toEqual(["flex", "flex-col", "gap-1"])
    expect(body?.children).toHaveLength(2)
  })

  it("respects a controlled open value", async () => {
    render(<Controlled />)
    expect(screen.getByText("Body")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Work" }))
    expect(screen.queryByText("Body")).toBeNull()
  })
})
