import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Popover, PopoverContent, PopoverTrigger } from "./components/popover"

function openPopover() {
  render(
    <Popover open>
      <PopoverTrigger>Filter</PopoverTrigger>
      <PopoverContent>Only open Jobs</PopoverContent>
    </Popover>
  )
  return screen
    .getByText("Only open Jobs")
    .closest("[data-slot=popover-content]")!
}

afterEach(cleanup)

describe("the popover opens and closes on the shared pop motion", () => {
  it("uses the motion-pop utility from its trigger", () => {
    const popup = openPopover()
    expect(popup.className.split(/\s+/)).toContain("motion-pop")
  })

  it("no longer runs library keyframes, a slide or its own timing", () => {
    const classes = openPopover().className.split(/\s+/)
    expect(
      classes.filter((name) =>
        /animate-(?:in|out)|slide-in|zoom-|fade-|duration-|ease-|origin-/.test(
          name
        )
      )
    ).toEqual([])
  })
})
