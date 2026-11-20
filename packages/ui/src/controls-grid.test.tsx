import "@testing-library/jest-dom/vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import { Button } from "./components/button"
import {
  DIALOG_LAYOUT_CLASS,
  Dialog,
  DialogContent,
  DialogTitle,
  type DialogLayout,
} from "./components/dialog"
import { panelFit, type Viewport } from "./lib/dialog-fit"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./components/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/select"
import { Toaster, toastWithUndo } from "./components/sonner"

afterEach(cleanup)

const classesOf = (element: Element) => element.className.split(/\s+/)

type Oklch = [number, number, number]

function shippedTokenValues() {
  const css = readFileSync(
    path.join(import.meta.dirname, "styles/globals.css"),
    "utf8"
  )
  const body = /^:root \{\n([\s\S]*?)^\}/m.exec(css)?.[1] ?? ""
  const values = new Map<string, string>()
  for (const [, name, value] of body.matchAll(
    /^  --([a-z0-9-]+): ([^;]+);/gm
  )) {
    values.set(name, value)
  }
  return values
}

function tokenColor(values: Map<string, string>, name: string): Oklch {
  const value = values.get(name)
  const alias = value?.match(/^var\(--([a-z0-9-]+)\)$/)
  if (alias) return tokenColor(values, alias[1])
  if (value?.match(/^#[0-9a-f]{6}$/)) return hexToOklch(value)
  const oklch = value?.match(/^oklch\(([^)]+)\)$/)
  if (!oklch) throw new Error(`Expected a color for --${name}`)
  const [lightness, chroma, hue] = oklch[1].split(/\s+/).map(Number)
  return [lightness, chroma, hue]
}

function hexToOklch(hex: string): Oklch {
  const [red, green, blue] = [1, 3, 5].map((offset) =>
    decode(Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
  )
  const l = Math.cbrt(
    0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue
  )
  const m = Math.cbrt(
    0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue
  )
  const s = Math.cbrt(
    0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue
  )
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    Math.hypot(a, b),
    (Math.atan2(b, a) * 180) / Math.PI,
  ]
}

function linearRgb([l, c, h]: Oklch) {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const lp = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mp = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const sp = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp,
    -1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp,
    -0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp,
  ].map((channel) => Math.min(Math.max(channel, 0), 1))
}

function luminance(color: Oklch) {
  const [r, g, b] = linearRgb(color)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(one: Oklch, two: Oklch) {
  const [high, low] = [luminance(one), luminance(two)].sort((a, b) => b - a)
  return (high + 0.05) / (low + 0.05)
}

function mix(base: Oklch, other: Oklch, share: number): Oklch {
  const fromHue = base[1] === 0 ? other[2] : base[2]
  const toHue = other[1] === 0 ? fromHue : other[2]
  const hueDistance = ((((toHue - fromHue + 180) % 360) + 360) % 360) - 180
  return [
    base[0] + (other[0] - base[0]) * share,
    base[1] + (other[1] - base[1]) * share,
    fromHue + hueDistance * share,
  ]
}

const encode = (channel: number) =>
  channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055
const decode = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4

function overLuminance(top: Oklch, alpha: number, under: Oklch) {
  const upper = linearRgb(top).map(encode)
  const lower = linearRgb(under).map(encode)
  const [r, g, b] = upper.map((channel, index) =>
    decode(channel * alpha + lower[index] * (1 - alpha))
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastOn(text: Oklch, backgroundLuminance: number) {
  const [high, low] = [luminance(text), backgroundLuminance].sort(
    (a, b) => b - a
  )
  return (high + 0.05) / (low + 0.05)
}

describe("primary and destructive buttons: states by sizes in the shipped light theme", () => {
  const VARIANTS = ["primary", "destructive"] as const
  const SIZES = ["default", "sm"] as const
  const HEIGHT = { default: "h-8", sm: "h-7" }
  const FILL = { primary: "bg-primary", destructive: "bg-destructive" }

  for (const variant of VARIANTS)
    for (const size of SIZES)
      it(`${variant} ${size}: a solid fill with distinct rest, hover, pressed, focus-visible and disabled looks`, () => {
        render(
          <Button variant={variant} size={size}>
            Go
          </Button>
        )
        const button = screen.getByRole("button", { name: "Go" })
        const classes = classesOf(button)
        expect(button).toHaveAttribute("data-variant", variant)
        expect(classes).toEqual(
          expect.arrayContaining([
            FILL[variant],
            HEIGHT[size],
            "text-ui",
            "rounded-md",
            "px-3",
          ])
        )
        const hover = classes.find((c) => c.startsWith("hover:bg-"))
        const pressed = classes.find((c) => c.startsWith("active:bg-"))
        expect(hover).toBeDefined()
        expect(pressed).toBeDefined()
        expect(new Set([FILL[variant], hover, pressed]).size).toBe(3)
        expect(classes).toContain("disabled:opacity-40")
        expect(classes.some((c) => c.startsWith("focus-visible:ring"))).toBe(
          true
        )
        expect(button.className).not.toMatch(/radial-gradient|\bglow\b/)
      })

  it("keeps a disabled primary out of pointer reach", () => {
    render(
      <Button variant="primary" disabled>
        Add job
      </Button>
    )
    const button = screen.getByRole("button", { name: "Add job" })
    expect(button).toBeDisabled()
    expect(classesOf(button)).toContain("disabled:pointer-events-none")
  })
})

describe("contrast computed from the shipped tokens", () => {
  const values = shippedTokenValues()
  const color = (name: string) => tokenColor(values, name)
  const card = color("card")
  const popover = color("popover")
  const primary = color("primary")
  const onPrimary = color("primary-foreground")
  const destructive = color("destructive")
  const onDestructive: Oklch = [1, 0, 0]
  const foreground = color("foreground")

  const TEXT = [
    ["primary label at rest", onPrimary, primary],
    ["primary label on hover", onPrimary, mix(primary, onPrimary, 0.12)],
    ["primary label pressed", onPrimary, mix(primary, onPrimary, 0.22)],
    ["destructive label at rest", onDestructive, destructive],
    [
      "destructive label on hover",
      onDestructive,
      mix(destructive, foreground, 0.1),
    ],
    [
      "destructive label pressed",
      onDestructive,
      mix(destructive, foreground, 0.2),
    ],
    ["red menu item on the popover", destructive, popover],
    ["menu and toast text", color("popover-foreground"), popover],
    ["muted menu label", color("muted-foreground"), popover],
  ] as const

  for (const [name, text, fill] of TEXT)
    it(`${name} reaches 4.5:1`, () => {
      expect(contrast(text, fill)).toBeGreaterThanOrEqual(4.5)
    })

  const highlight = overLuminance(destructive, 0.1, popover)
  const highlightedRed = mix(destructive, foreground, 0.15)

  it("red menu row text reaches 4.5:1 on hover and keyboard focus over its red tint", () => {
    expect(contrastOn(highlightedRed, highlight)).toBeGreaterThanOrEqual(4.5)
    expect(contrastOn(destructive, highlight)).toBeLessThan(4.5)
  })

  it("red menu row icon reaches 3:1 on hover and keyboard focus", () => {
    expect(contrastOn(destructive, highlight)).toBeGreaterThanOrEqual(3)
  })

  const CONTROLS = [
    ["primary fill on the card", primary, card],
    ["destructive fill on the card", destructive, card],
    ["focus ring on the card", color("ring"), card],
    ["muted icon on the popover", color("muted-foreground"), popover],
  ] as const

  for (const [name, mark, fill] of CONTROLS)
    it(`${name} reaches 3:1`, () => {
      expect(contrast(mark, fill)).toBeGreaterThanOrEqual(3)
    })
})

describe("dialog: one veil, one corner, one padding, anchored near the top", () => {
  it("draws a light veil with no blur and a 12px card 24px inside, top-anchored", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Delete “CV.docx”?</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    const veil = document.querySelector("[data-slot=dialog-overlay]")!
    const card = document.querySelector("[data-slot=dialog-content]")!
    expect(veil.className).not.toMatch(/backdrop-blur/)
    expect(classesOf(veil)).toContain("bg-foreground/10")
    expect(classesOf(card)).toEqual(
      expect.arrayContaining([
        "rounded-lg",
        "p-6",
        "top-[clamp(16px,14dvh,120px)]",
        "max-h-[calc(100dvh-clamp(16px,14dvh,120px)-16px)]",
        "overflow-y-auto",
      ])
    )
    expect(card.className).not.toMatch(/-translate-y-1\/2|top-1\/2/)
  })
})

describe("dialog close control", () => {
  it("stays pinned at the top of a panel whose content scrolls, after the content is scrolled to the bottom, and comes last in Tab order", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>New CV</DialogTitle>
          {Array.from({ length: 40 }, (_, index) => (
            <button key={index} type="button">
              Template {index}
            </button>
          ))}
        </DialogContent>
      </Dialog>
    )
    const panel = document.querySelector<HTMLElement>(
      "[data-slot=dialog-content]"
    )!
    expect(classesOf(panel)).toEqual(
      expect.arrayContaining(["overflow-y-auto", "pt-2"])
    )
    panel.scrollTop = panel.scrollHeight
    const close = screen.getByRole("button", { name: "Close" })
    const pin = close.closest("[data-slot=dialog-close-pin]")!
    expect(pin.parentElement).toBe(panel)
    expect(classesOf(pin)).toEqual(
      expect.arrayContaining(["sticky", "top-2", "order-first", "h-0", "z-10"])
    )
    expect(classesOf(close)).toEqual(
      expect.arrayContaining(["absolute", "bg-popover", "max-md:size-11"])
    )
    expect(panel.lastElementChild).toBe(pin)
  })

  it("leaves a panel without a close control at its own top padding", () => {
    render(
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Delete “CV.docx”?</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    const panel = document.querySelector("[data-slot=dialog-content]")!
    expect(classesOf(panel)).not.toContain("pt-2")
    expect(document.querySelector("[data-slot=dialog-close-pin]")).toBeNull()
  })
})

describe("menu rows", () => {
  it("are 13px, 32 tall, 44 tall on phones, never wrap, and sit in a menu at least 220 wide", async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>More</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Link to application</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const content = await screen.findByRole("menu")
    expect(classesOf(content)).toEqual(
      expect.arrayContaining([
        "w-max",
        "min-w-[max(220px,var(--anchor-width))]",
        "max-w-[calc(100vw-32px)]",
      ])
    )
    for (const item of screen.getAllByRole("menuitem"))
      expect(classesOf(item)).toEqual(
        expect.arrayContaining([
          "text-ui",
          "min-h-8",
          "max-md:min-h-11",
          "whitespace-nowrap",
        ])
      )
    const remove = screen.getByRole("menuitem", { name: "Delete" })
    expect(remove).toHaveAttribute("data-variant", "destructive")
    expect(classesOf(remove)).toEqual(
      expect.arrayContaining([
        "data-[variant=destructive]:text-destructive",
        "data-[variant=destructive]:focus:text-[color-mix(in_oklch,var(--destructive),var(--foreground)_15%)]",
        "data-[variant=destructive]:focus:bg-destructive/10",
      ])
    )
    expect(screen.getByRole("separator")).toBeInTheDocument()
  })
})

describe("select", () => {
  it("opens below its trigger with 13px rows, 32 tall and 44 on phones", async () => {
    render(
      <Select defaultValue="utc">
        <SelectTrigger aria-label="Time zone">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="utc">UTC</SelectItem>
          <SelectItem value="ict">Indochina Time</SelectItem>
        </SelectContent>
      </Select>
    )
    await userEvent.click(screen.getByRole("combobox", { name: "Time zone" }))
    const popup = document.querySelector("[data-slot=select-content]")!
    expect(popup).toHaveAttribute("data-align-trigger", "false")
    for (const item of document.querySelectorAll("[data-slot=select-item]"))
      expect(classesOf(item)).toEqual(
        expect.arrayContaining(["text-ui", "min-h-8", "max-md:min-h-11"])
      )
  })
})

describe("toast", () => {
  it("is one row on the app tokens: icon, 13px message, a text Undo and a close control, 44 targets on phones", async () => {
    render(<Toaster />)
    act(() => {
      toastWithUndo("Deleted CV.docx", () => undefined)
    })
    const toast = await screen.findByText("Deleted CV.docx")
    const row = toast.closest("[data-sonner-toast]")!
    expect(row).toHaveAttribute("data-styled", "false")
    expect(classesOf(row)).toEqual(
      expect.arrayContaining([
        "bg-popover",
        "text-popover-foreground",
        "border-border",
        "text-ui",
        "min-h-11",
      ])
    )
    expect(row.querySelector("[data-icon] svg")).not.toBeNull()
    const undo = screen.getByRole("button", { name: "Undo" })
    expect(undo.className).not.toMatch(/\bbg-primary\b|\bbg-foreground\b/)
    expect(classesOf(undo)).toEqual(
      expect.arrayContaining(["max-md:h-11", "max-md:min-w-11"])
    )
    const close = row.querySelector("[data-close-button]")!
    expect(close).not.toBeNull()
    expect(classesOf(close)).toEqual(
      expect.arrayContaining(["order-last", "max-md:size-11"])
    )
  })
})

const WINDOWS: Viewport[] = [
  { width: 390, height: 844 },
  { width: 390, height: 560 },
  { width: 600, height: 480 },
  { width: 820, height: 512 },
  { width: 1024, height: 700 },
  { width: 1440, height: 900 },
]

type DialogSite = {
  layout: DialogLayout
  className: string
  hasOutsideControl: boolean
}

function fitProblems(site: DialogSite, window: Viewport) {
  return panelFit(
    `${DIALOG_LAYOUT_CLASS[site.layout]} ${site.className}`,
    window,
    { hasOutsideControl: site.hasOutsideControl }
  ).problems
}

describe("the dialog fit model at every window size", () => {
  const DRAWER_AT_B19A5BAD = {
    layout: "dialog" as const,
    className:
      "top-0 left-0 h-svh w-[244px] max-w-[80vw] translate-x-0 translate-y-0 rounded-none p-0 duration-(--duration-panel) ease-(--ease-panel)",
    hasOutsideControl: true,
  }
  const GALLERY_AT_B19A5BAD = {
    layout: "dialog" as const,
    className: "max-h-[90vh] overflow-y-auto sm:max-w-3xl",
    hasOutsideControl: false,
  }

  it("fails the phone drawer as it shipped at b19a5bad: cut to 710 of 844 and its close button clipped", () => {
    expect(
      fitProblems(DRAWER_AT_B19A5BAD, { width: 390, height: 844 })
    ).toEqual([
      "is a full-height panel cut to 710 of 844px",
      "clips a control placed outside it (overflow auto)",
    ])
  })

  it("fails the New CV gallery as it shipped at b19a5bad: past the bottom at 390x844 and 820x512", () => {
    expect(
      fitProblems(GALLERY_AT_B19A5BAD, { width: 390, height: 844 })
    ).toEqual(["ends at 878, past the 844px window"])
    expect(
      fitProblems(GALLERY_AT_B19A5BAD, { width: 820, height: 512 })
    ).toEqual(["ends at 532, past the 512px window"])
  })

  it("passes the drawer as a sheet and the gallery under the kit cap", () => {
    for (const window of WINDOWS) {
      expect(
        fitProblems(
          {
            ...DRAWER_AT_B19A5BAD,
            layout: "sheet",
            className: "top-0 left-0 h-svh w-[244px] max-w-[80vw]",
          },
          window
        )
      ).toEqual([])
      expect(
        fitProblems(
          { ...GALLERY_AT_B19A5BAD, className: "sm:max-w-3xl" },
          window
        )
      ).toEqual([])
    }
  })
})
