import "@testing-library/jest-dom/vitest"
import { readdirSync, readFileSync } from "node:fs"
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

const SHIPPED_THEME = ":root"

function tokensOf(block: string) {
  const css = readFileSync(
    path.join(import.meta.dirname, "styles/globals.css"),
    "utf8"
  )
  const start = css.indexOf(`${block} {`)
  const body = css.slice(start, css.indexOf("}", start))
  return Object.fromEntries(
    [...body.matchAll(/--([a-z0-9-]+):\s*oklch\(([^)]+)\)/g)].map(
      ([, name, value]) => [name, value.split(/[\s/]+/).map(Number)]
    )
  ) as Record<string, number[]>
}

type Oklch = [number, number, number]

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
  const hue = base[1] === 0 ? other[2] : base[2]
  return [
    base[0] + (other[0] - base[0]) * share,
    base[1] + (other[1] - base[1]) * share,
    hue,
  ]
}

const solid = (token: number[]): Oklch => [token[0], token[1], token[2] ?? 0]

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
            "text-[13px]",
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
  const t = tokensOf(SHIPPED_THEME)
  const card = solid(t.card)
  const popover = solid(t.popover)
  const primary = solid(t.primary)
  const onPrimary = solid(t["primary-foreground"])
  const destructive = solid(t.destructive)
  const onDestructive: Oklch = [1, 0, 0]
  const foreground = solid(t.foreground)

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
    ["menu and toast text", solid(t["popover-foreground"]), popover],
    ["muted menu label", solid(t["muted-foreground"]), popover],
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
    ["focus ring on the card", solid(t.ring), card],
    ["muted icon on the popover", solid(t["muted-foreground"]), popover],
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
        "rounded-[12px]",
        "p-6",
        "top-[clamp(16px,14dvh,120px)]",
        "max-h-[calc(100dvh-clamp(16px,14dvh,120px)-16px)]",
        "overflow-y-auto",
      ])
    )
    expect(card.className).not.toMatch(/-translate-y-1\/2|top-1\/2/)
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
          "text-[13px]",
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
        expect.arrayContaining(["text-[13px]", "min-h-8", "max-md:min-h-11"])
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
        "text-[13px]",
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

const APP_SOURCE = path.join(import.meta.dirname, "../../../apps/web/src")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.")
      ? [full]
      : []
  })
}

function openingTag(source: string, start: number) {
  let depth = 0
  let quote = ""
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    if (quote) {
      if (char === quote) quote = ""
    } else if (char === '"' || char === "`") quote = char
    else if (char === "{") depth += 1
    else if (char === "}") depth -= 1
    else if (char === ">" && depth === 0) return source.slice(start, index + 1)
  }
  throw new Error("unclosed DialogContent tag")
}

type DialogSite = {
  name: string
  layout: DialogLayout
  className: string
  hasOutsideControl: boolean
}

function dialogSites(): DialogSite[] {
  const files = sourceFiles(APP_SOURCE)
  const texts = new Map(files.map((file) => [file, readFileSync(file, "utf8")]))
  const constant = (name: string) => {
    for (const text of texts.values()) {
      const found = new RegExp(`const ${name} =\\s*"([^"]*)"`).exec(text)
      if (found) return found[1]
    }
    throw new Error(`cannot find ${name}`)
  }
  return [...texts].flatMap(([file, text]) =>
    [...text.matchAll(/<DialogContent\b/g)].map((match) => {
      const tag = openingTag(text, match.index)
      const literal = /className="([^"]*)"/.exec(tag)?.[1]
      const named = /className=\{[^}]*?\b([A-Z][A-Z0-9_]+)\b[^}]*\}/.exec(
        tag
      )?.[1]
      const body = text.slice(
        match.index + tag.length,
        text.indexOf("</DialogContent>", match.index)
      )
      return {
        name: `${path.relative(APP_SOURCE, file)}:${text.slice(0, match.index).split("\n").length}`,
        layout: (/layout="(\w+)"/.exec(tag)?.[1] ?? "dialog") as DialogLayout,
        className: literal ?? (named ? constant(named) : ""),
        hasOutsideControl: /(^|[\s"])-(right|left|top|bottom)-\d/.test(body),
      }
    })
  )
}

function fitProblems(site: Omit<DialogSite, "name">, window: Viewport) {
  return panelFit(
    `${DIALOG_LAYOUT_CLASS[site.layout]} ${site.className}`,
    window,
    { hasOutsideControl: site.hasOutsideControl }
  ).problems
}

describe("every dialog and dialog-based panel fits the window at every size", () => {
  const sites = dialogSites()

  it("finds the dialog call sites, the phone drawer and the template gallery among them", () => {
    expect(sites.length).toBeGreaterThanOrEqual(15)
    expect(
      sites.some((site) =>
        site.name.startsWith("features/app-shell/app-shell.tsx")
      )
    ).toBe(true)
    expect(sites.some((site) => site.className.includes("sm:max-w-3xl"))).toBe(
      true
    )
  })

  for (const window of WINDOWS)
    it(`at ${window.width}x${window.height} each panel stays inside, full-height panels stay full, outside controls stay visible`, () => {
      const problems = sites.flatMap((site) =>
        fitProblems(site, window).map((problem) => `${site.name} ${problem}`)
      )
      expect(problems).toEqual([])
    })

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
