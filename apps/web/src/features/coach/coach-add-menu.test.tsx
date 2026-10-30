import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { expectCoachIdle } from "@/test/coach-chat-helpers.ts"
import { getLastCoachRequest, scriptCoachStream } from "@/test/chat-api-mock.ts"
import {
  failPaperList,
  getMockPaperDocs,
  holdPaperList,
  resetPaperApiMock,
} from "@/test/paper-api-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

import layout from "./design/composer-menus.geometry.json"
import snapshot from "./design/composer-menus.source.json"

const css = readFileSync(
  path.resolve(
    process.cwd(),
    "src/features/coach/design/composer-menus.pen.css"
  ),
  "utf8"
)

type Row = (typeof layout.rows)[number]
const items = layout.rows.filter((row: Row) => row.kind === "item")
const ACTIONS = items.slice(0, 4)

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
  resetPaperApiMock()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function openAdd() {
  renderApp(SURFACE_PATHS.coach)
  await expectCoachIdle()
  fireEvent.click(screen.getByRole("button", { name: "Add" }))
  return screen.findByRole("menu")
}

function declared(selector: string, property: string) {
  const block = css
    .split("}")
    .map((chunk) => chunk.split("{"))
    .find(([head]) => head?.replace(/\s+/g, " ").trim().endsWith(selector))
  const match = new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`).exec(
    block?.[1] ?? ""
  )
  return match?.[1]?.replace(/\s+/g, " ").trim()
}

const MENU = '[data-slot="coach-add-menu"]'

describe("Coach Add menu against its pen frame (kfJuz popover f0tcTl)", () => {
  it("lists the pen's action rows in the pen's order with its icons", async () => {
    const menu = await openAdd()
    const rows = within(menu).getAllByRole("menuitem")
    const labels = rows
      .slice(0, ACTIONS.length)
      .map((row) => row.textContent?.replace(/Coach cannot.*$/, ""))
    expect(labels).toEqual(ACTIONS.map((row) => row.text))
    rows.slice(0, ACTIONS.length).forEach((row, index) => {
      const icon = row.querySelector("svg")
      expect(icon?.getAttribute("class")).toContain(
        `lucide-${ACTIONS[index]?.icon?.name}`
      )
      expect(Boolean(row.querySelector("[data-add-caret]"))).toBe(
        Boolean(ACTIONS[index]?.trailing)
      )
    })
    const frameTexts = snapshot.sections.flatMap((section) => section.texts)
    const start = frameTexts.indexOf(ACTIONS[0]!.text)
    expect(frameTexts.slice(start, start + 4)).toEqual(
      ACTIONS.map((row) => row.text)
    )
    expect(frameTexts).not.toContain("Add connector")
    expect(menu).not.toHaveTextContent("Add connector")
    expect(within(menu).getByText(layout.rows[5]?.text ?? "")).toBeVisible()
  })

  it("sizes the panel and rows as the pen does", () => {
    const px = (value: number | undefined) => `${value}px`
    const { popover } = layout
    expect(declared(MENU, "font-family")).toBe("var(--font-sans)")
    expect(declared(MENU, "width")).toBe(px(popover.width))
    expect(declared(MENU, "border-radius")).toBe(px(popover.cornerRadius))
    expect(declared(MENU, "padding")).toBe(px(popover.padding))
    expect(declared(MENU, "gap")).toBe(px(popover.gap))
    const first = ACTIONS[0]
    expect(declared("[data-add-row]", "height")).toBe(px(first?.height))
    expect(declared("[data-add-row]", "gap")).toBe(px(first?.gap))
    expect(declared("[data-add-row]", "font-size")).toBe(px(first?.fontSize))
    expect(declared("[data-add-row]", "border-radius")).toBe(
      px(first?.cornerRadius)
    )
    expect(declared("[data-add-row] > svg:first-child", "width")).toBe(
      px(first?.icon?.size)
    )
    const label = layout.rows.find((row: Row) => row.kind === "label")
    expect(declared("[data-add-recent-label]", "font-size")).toBe(
      px(label?.fontSize)
    )
  })

  it("lists the two most recently updated Paper documents, not sample names", async () => {
    const menu = await openAdd()
    const recent = [...getMockPaperDocs()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 2)
    for (const doc of recent) {
      expect(
        await within(menu).findByRole("menuitem", { name: doc.name })
      ).toBeInTheDocument()
    }
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(
      ACTIONS.length + 2
    )
  })

  it("marks a selected Recent document and sends it as context", async () => {
    scriptCoachStream({ texts: ["Got it."] })
    const menu = await openAdd()
    const doc = [...getMockPaperDocs()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    )[0]!
    fireEvent.click(
      await within(menu).findByRole("menuitem", { name: doc.name })
    )
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    const reopened = await screen.findByRole("menu")
    expect(
      await within(reopened).findByRole("menuitem", {
        name: `${doc.name}, attached`,
      })
    ).toBeInTheDocument()
    fireEvent.keyDown(reopened, { key: "Escape" })

    fireEvent.change(screen.getByRole("textbox", { name: "Message Coach" }), {
      target: { value: "Review this" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    await waitFor(() => {
      expect(getLastCoachRequest()?.context).toEqual([
        { kind: "paper", id: doc.id },
      ])
    })
  })

  it("says Upload a file is unavailable and does nothing", async () => {
    const menu = await openAdd()
    const upload = within(menu).getByRole("menuitem", { name: /Upload a file/ })
    expect(upload).toHaveAttribute("aria-disabled", "true")
    expect(upload).toHaveTextContent("Coach cannot read uploaded files yet.")
  })

  it("shows a loading note then an error note for Recent", async () => {
    const release = holdPaperList()
    const menu = await openAdd()
    expect(await within(menu).findByText("Loading…")).toBeInTheDocument()
    release()
    await within(menu).findByRole("menuitem", {
      name: /PM track CV/,
    })
  })

  it("shows a note when Paper cannot load", async () => {
    failPaperList()
    const menu = await openAdd()
    expect(
      await within(menu).findByText("Could not load Paper.")
    ).toBeInTheDocument()
  })

  it("opens with the keyboard, selects with Enter and returns focus on Escape", async () => {
    const user = userEvent.setup()
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    const add = screen.getByRole("button", { name: "Add" })
    add.focus()
    await user.keyboard("{Enter}")
    const menu = await screen.findByRole("menu")
    const link = within(menu).getByRole("menuitem", {
      name: "Paste a job link",
    })
    for (let step = 0; step < 8 && document.activeElement !== link; step += 1)
      await user.keyboard("{ArrowDown}")
    expect(link).toHaveFocus()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
    expect(screen.getByRole("button", { name: "Add" })).toHaveFocus()

    await user.keyboard("{Enter}")
    await screen.findByRole("menu")
    const again = within(await screen.findByRole("menu")).getByRole(
      "menuitem",
      {
        name: "Paste a job link",
      }
    )
    for (let step = 0; step < 8 && document.activeElement !== again; step += 1)
      await user.keyboard("{ArrowDown}")
    await user.keyboard("{Enter}")
    expect(await screen.findByRole("dialog")).toHaveTextContent("Paste a link")
  })
})
