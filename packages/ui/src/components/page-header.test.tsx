import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Briefcase, Link2, Plus, Star } from "lucide-react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb"
import {
  PageHeader,
  PageHeaderAction,
  PageHeaderActions,
  PageHeaderBack,
  PageHeaderLeading,
  PageHeaderMeta,
  PageHeaderPrimary,
  PageHeaderTitle,
  PageHeaderTitleActions,
} from "./page-header"

afterEach(cleanup)

const LONG = "Senior staff engineer, platform reliability and developer tools"

function DetailHeader({ onCopy = () => {} }: { onCopy?: () => void }) {
  return (
    <PageHeader>
      <PageHeaderLeading>
        <PageHeaderBack href="/apply">Apply</PageHeaderBack>
      </PageHeaderLeading>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/apply">Apply</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage icon={<Briefcase />}>{LONG}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeaderTitleActions>
        <PageHeaderAction label="Favorite" icon={<Star />} pressed />
      </PageHeaderTitleActions>
      <PageHeaderMeta showOnPhone>3 / 7</PageHeaderMeta>
      <PageHeaderActions overflowLabel="More actions">
        <PageHeaderAction
          label="Copy link"
          icon={<Link2 />}
          onSelect={onCopy}
          collapse
        />
        <PageHeaderAction label="Properties" icon={<Star />} />
        <PageHeaderPrimary icon={<Plus />}>New job</PageHeaderPrimary>
      </PageHeaderActions>
    </PageHeader>
  )
}

describe("PageHeader overflow", () => {
  it("moves only the collapsible actions into the More actions menu", async () => {
    const user = userEvent.setup()
    const onCopy = vi.fn()
    render(<DetailHeader onCopy={onCopy} />)

    const inline = screen.getByRole("button", { name: "Copy link" })
    expect(inline).toHaveClass("max-md:hidden")
    expect(screen.getByRole("button", { name: "Properties" })).not.toHaveClass(
      "max-md:hidden"
    )

    const trigger = screen.getByRole("button", { name: "More actions" })
    expect(trigger).toHaveClass("md:hidden", "max-md:size-11")
    await user.click(trigger)

    const items = screen.getAllByRole("menuitem")
    expect(items.map((item) => item.textContent)).toEqual(["Copy link"])
    await user.click(items[0]!)
    expect(onCopy).toHaveBeenCalledTimes(1)
  })

  it("closes the menu with Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup()
    render(<DetailHeader />)
    const trigger = screen.getByRole("button", { name: "More actions" })
    await user.click(trigger)
    expect(screen.getByRole("menu")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it("renders no overflow trigger when the actions do not name one", () => {
    render(
      <PageHeader>
        <PageHeaderActions>
          <PageHeaderAction label="Copy link" icon={<Link2 />} collapse />
        </PageHeaderActions>
      </PageHeader>
    )
    expect(
      screen.queryByRole("button", { name: "More actions" })
    ).not.toBeInTheDocument()
  })

  it("keeps the primary action and every visible control at 44px on a phone", () => {
    render(<DetailHeader />)
    const primary = screen.getByRole("button", { name: "New job" })
    expect(primary).toHaveAttribute("data-primary-action")
    expect(primary).toHaveClass("h-7", "max-md:h-11")
    for (const name of ["Favorite", "Properties"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("max-md:size-11")
    }
  })

  it("sizes title actions at 26px and right actions at 28px", () => {
    render(<DetailHeader />)
    expect(screen.getByRole("button", { name: "Favorite" })).toHaveClass(
      "size-[26px]"
    )
    expect(screen.getByRole("button", { name: "Properties" })).toHaveClass(
      "size-7"
    )
  })

  it("shows the label of a text action and keeps it in the More actions menu", async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(
      <PageHeader>
        <PageHeaderTitle>Inbox</PageHeaderTitle>
        <PageHeaderActions overflowLabel="More actions">
          <PageHeaderAction
            label="Done"
            icon={<Star />}
            showLabel
            collapse
            onSelect={onDone}
          />
        </PageHeaderActions>
      </PageHeader>
    )
    const inline = screen.getByRole("button", { name: "Done" })
    expect(inline).toHaveTextContent("Done")
    expect(inline).toHaveClass("h-7", "max-md:hidden")
    expect(inline).not.toHaveClass("size-7")
    await user.click(inline)
    expect(onDone).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole("button", { name: "More actions" }))
    await user.click(await screen.findByRole("menuitem", { name: "Done" }))
    expect(onDone).toHaveBeenCalledTimes(2)
  })

  it("keeps the DOM order equal to the visual order", () => {
    render(<DetailHeader />)
    const order = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent)
    expect(order).toEqual([
      "Favorite",
      "Copy link",
      "Properties",
      "New job",
      "More actions",
    ])
  })

  it("sets aria-pressed on a pressed action", () => {
    render(<DetailHeader />)
    expect(screen.getByRole("button", { name: "Favorite" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })
})

describe("PageHeader breadcrumb", () => {
  it("names the nav and marks the current page", () => {
    render(<DetailHeader />)
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" })
    const current = nav.querySelector('[aria-current="page"]')
    expect(current).toHaveTextContent(LONG)
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    expect(nav.querySelector("a")).toHaveAttribute("href", "/apply")
    expect(nav.querySelector("a")).not.toHaveAttribute("aria-current")
  })

  it("hides the parent crumbs on a phone and shows the back link there", () => {
    render(<DetailHeader />)
    const header = document.querySelector('[data-slot="page-header"]')!
    expect(header).toHaveClass(
      "max-md:[&_[data-slot=breadcrumb-item]:not(:last-child)]:hidden"
    )
    expect(screen.getAllByRole("link", { name: "Apply" })).toHaveLength(2)
    expect(
      header.querySelector('[data-slot="page-header-leading"]')
    ).toHaveClass("md:hidden")
    expect(header.querySelector('[data-slot="page-header-back"]')).toHaveClass(
      "h-11"
    )
  })

  it("truncates the current crumb in the middle and keeps the rest from shrinking", () => {
    render(<DetailHeader />)
    const page = document.querySelector('[data-slot="breadcrumb-page"]')!
    expect(page).toHaveAttribute("title", LONG)
    expect(page).toHaveClass("min-w-0", "max-md:min-w-24")
    expect(page.querySelector(".truncate")).toHaveTextContent(LONG)
    const items = document.querySelectorAll('[data-slot="breadcrumb-item"]')
    expect(items[0]).toHaveClass("shrink-0")
    expect(items[1]).toHaveClass("last:min-w-0", "last:shrink")
    expect(
      document.querySelector('[data-slot="page-header-title-actions"]')
    ).toHaveClass("shrink-0")
    expect(
      document.querySelector('[data-slot="page-header-actions"]')
    ).toHaveClass("shrink-0")
  })
})

describe("PageHeaderTitle", () => {
  it("is the one h1 by default", () => {
    render(
      <PageHeader>
        <PageHeaderTitle>Inbox</PageHeaderTitle>
      </PageHeader>
    )
    expect(screen.getByRole("heading", { level: 1, name: "Inbox" })).toBe(
      document.querySelector('[data-slot="page-header-title"]')
    )
    expect(screen.getAllByRole("heading")).toHaveLength(1)
  })

  it("is not a heading when the body owns the h1", () => {
    render(
      <>
        <PageHeader>
          <PageHeaderTitle as="div">Apply</PageHeaderTitle>
        </PageHeader>
        <h1>Staff engineer</h1>
      </>
    )
    const headings = screen.getAllByRole("heading")
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent("Staff engineer")
    expect(
      document.querySelector('[data-slot="page-header-title"]')?.tagName
    ).toBe("DIV")
  })

  it("truncates a long title and carries the full text in title", () => {
    render(
      <PageHeader>
        <PageHeaderTitle>{LONG}</PageHeaderTitle>
      </PageHeader>
    )
    const title = screen.getByRole("heading", { name: LONG })
    expect(title).toHaveClass("min-w-0", "truncate")
    expect(title).toHaveAttribute("title", LONG)
  })

  it("still accepts the title prop of the earlier header", () => {
    render(<PageHeader title="Jobs" />)
    expect(
      screen.getByRole("heading", { level: 1, name: "Jobs" })
    ).toBeInTheDocument()
  })
})

describe("PageHeader frame", () => {
  it("is a 52px bar with the pen padding and no fill", () => {
    render(<PageHeader />)
    const header = document.querySelector('[data-slot="page-header"]')!
    expect(header).toHaveClass(
      "h-[52px]",
      "shrink-0",
      "gap-2",
      "border-b",
      "border-border",
      "pr-4",
      "pl-5"
    )
    expect(header.className).not.toMatch(/\bbg-/)
    expect(header.className).not.toMatch(/\b(?:sticky|fixed)\b/)
  })

  it("puts the meta at the right and drops the actions auto margin after it", () => {
    render(
      <PageHeader>
        <PageHeaderMeta>3 / 7</PageHeaderMeta>
        <PageHeaderActions />
      </PageHeader>
    )
    expect(
      document.querySelector('[data-slot="page-header-meta"]')
    ).toHaveClass("ml-auto", "max-md:hidden")
    expect(
      document.querySelector('[data-slot="page-header-actions"]')
    ).toHaveClass("[[data-slot=page-header-meta]+&]:ml-0")
  })
})
