import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import "@testing-library/jest-dom/vitest"
import { useState } from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Dialog, DialogContent, DialogTitle } from "./components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./components/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "./components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "./components/select"
import { SegmentedControl } from "./components/segmented-control"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/tooltip"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const KEYFRAMES = /animate-(?:in|out)|zoom-|fade-|slide-in-from|duration-|ease-/

function classesOf(element: Element) {
  return element.className.toString().split(/\s+/)
}

function utility(name: string) {
  const css = readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "styles/globals.css"
    ),
    "utf8"
  )
  const start = css.indexOf(`@utility ${name} {`)
  const rest = css.slice(start + 1)
  const end = rest.search(/@utility |@layer /)
  return css.slice(start, start + 1 + end)
}

function openDialog(
  props: {
    instant?: boolean
    layout?: "dialog" | "sheet"
    side?: "start" | "end"
  } = {}
) {
  render(
    <Dialog open>
      <DialogContent {...props}>
        <DialogTitle>Delete this CV?</DialogTitle>
      </DialogContent>
    </Dialog>
  )
  return {
    popup: document.querySelector("[data-slot=dialog-content]")!,
    backdrop: document.querySelector("[data-slot=dialog-overlay]")!,
  }
}

describe("overlays enter on a transition that can reverse", () => {
  it("opens a dialog from the centre and its scrim on the backdrop motion", () => {
    const { popup, backdrop } = openDialog()
    expect(classesOf(popup)).toContain("motion-modal")
    expect(classesOf(backdrop)).toContain("motion-backdrop")
    expect(classesOf(popup).filter((name) => KEYFRAMES.test(name))).toEqual([])
    expect(classesOf(backdrop).filter((name) => KEYFRAMES.test(name))).toEqual(
      []
    )
    expect(popup).not.toHaveAttribute("data-side")
  })

  it("slides a sheet in from the edge it names, and back out the same way", async () => {
    const start = openDialog({ layout: "sheet" })
    expect(classesOf(start.popup)).toContain("motion-sheet-start")
    expect(start.popup).toHaveAttribute("data-side", "start")
    expect(start.popup).toHaveAttribute("data-starting-style", "")
    expect(start.backdrop).toHaveAttribute("data-starting-style", "")
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })
    expect(start.popup).not.toHaveAttribute("data-starting-style")
    expect(start.backdrop).not.toHaveAttribute("data-starting-style")
    cleanup()
    const end = openDialog({ layout: "sheet", side: "end" })
    expect(classesOf(end.popup)).toContain("motion-sheet-end")
    expect(end.popup).toHaveAttribute("data-side", "end")
    expect(classesOf(end.popup)).not.toContain("motion-modal")
  })

  it("opens a keyboard dialog with no travel", () => {
    const { popup, backdrop } = openDialog({ instant: true })
    const names = [...classesOf(popup), ...classesOf(backdrop)]
    expect(names.filter((name) => name.startsWith("motion-"))).toEqual([])
  })

  it.each([
    ["menu", "dropdown-menu-content"],
    ["submenu", "dropdown-menu-sub-content"],
    ["popover", "popover-content"],
    ["select", "select-content"],
    ["tooltip", "tooltip-content"],
  ] as const)("opens a %s from its trigger with motion-pop", (_name, slot) => {
    render(
      <>
        <DropdownMenu open>
          <DropdownMenuTrigger>Account</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSub open>
              <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Nested</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover open>
          <PopoverTrigger>Filter</PopoverTrigger>
          <PopoverContent>Only open Jobs</PopoverContent>
        </Popover>
        <Select open>
          <SelectTrigger>Language</SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
        <TooltipProvider>
          <Tooltip open>
            <TooltipTrigger>Hint</TooltipTrigger>
            <TooltipContent>Saved</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </>
    )
    const popup = document.querySelector(`[data-slot=${slot}]`)!
    expect(popup).not.toBeNull()
    expect(classesOf(popup)).toContain("motion-pop")
    expect(classesOf(popup).filter((name) => KEYFRAMES.test(name))).toEqual([])
    expect(classesOf(popup)).toContain("data-closed:pointer-events-none")
  })

  it("lets the page take clicks and focus the moment a dialog closes", async () => {
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button type="button">Behind</button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogTitle>Delete this CV?</DialogTitle>
              <button type="button" onClick={() => setOpen(false)}>
                Dismiss
              </button>
            </DialogContent>
          </Dialog>
        </>
      )
    }
    render(<Harness />)
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }))
    const popup = document.querySelector("[data-slot=dialog-content]")
    if (popup) {
      expect(popup).toHaveAttribute("data-closed")
      expect(popup.className).toContain("data-closed:pointer-events-none")
      popup.dispatchEvent(new Event("transitionend", { bubbles: true }))
    }
    await waitFor(() =>
      expect(document.querySelector("[data-slot=dialog-content]")).toBeNull()
    )
    expect(document.querySelector("[data-slot=dialog-overlay]")).toBeNull()
    const behind = screen.getByRole("button", { name: "Behind" })
    behind.focus()
    expect(document.activeElement).toBe(behind)
  })
})

describe("the motion utilities travel only by transform and opacity", () => {
  it("shares one transition for the start and the end, so a close halfway reverses", () => {
    for (const name of ["motion-pop", "motion-modal", "motion-sheet-start"]) {
      const block = utility(name)
      expect(block).toContain("&[data-starting-style]")
      expect(block).toContain("&[data-ending-style]")
      expect(block).toContain("transition-property:")
      expect(block).not.toMatch(/animation\s*:/)
    }
  })

  it("keeps a fade and drops travel when motion is reduced", () => {
    const pop = utility("motion-pop")
    expect(pop).toContain("prefers-reduced-motion: reduce")
    expect(pop).toContain("scale: 1")
    const sheet = utility("motion-sheet-start")
    expect(sheet).toContain("translate: 0 0")
    expect(sheet).toContain("opacity: 0")
    expect(utility("motion-backdrop")).not.toContain("translate:")
  })

  it("never transitions a layout property on an overlay", () => {
    for (const name of [
      "motion-pop",
      "motion-modal",
      "motion-backdrop",
      "motion-sheet-start",
      "motion-sheet-end",
    ]) {
      const property =
        utility(name).match(/transition-property:[^;]+/)?.[0] ?? ""
      expect(property).not.toMatch(
        /width|height|margin|padding|top|left|right|bottom|inset|font-size/
      )
    }
    expect(utility("motion-pop")).toContain(
      "transition-property: opacity, scale"
    )
    expect(utility("motion-sheet-end")).toContain(
      "transition-property: translate, opacity"
    )
    expect(utility("motion-press")).toContain(
      "scale: var(--motion-press-scale)"
    )
  })
})

describe("a segmented control does not animate its first measure", () => {
  it("marks the track ready only after fonts have loaded and one frame has passed", async () => {
    let resolveFonts: (value: unknown) => void = () => undefined
    const ready = new Promise((resolve) => {
      resolveFonts = resolve
    })
    const previous = Object.getOwnPropertyDescriptor(document, "fonts")
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready },
    })
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    )
    render(
      <SegmentedControl
        aria-label="Language"
        options={[
          { value: "en", label: "English" },
          { value: "vi", label: "Vietnamese" },
        ]}
        defaultValue="en"
      />
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.querySelector(".ui-segc")).not.toHaveAttribute("data-ready")
    resolveFonts(undefined)
    await ready
    await new Promise((resolve) =>
      requestAnimationFrame(() => resolve(undefined))
    )
    expect(document.querySelector(".ui-segc")).toHaveAttribute("data-ready", "")
    if (previous) Object.defineProperty(document, "fonts", previous)
  })
})
