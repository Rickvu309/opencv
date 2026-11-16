import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { cleanup, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CvEditorBar } from "@/features/paper/paper-cv-bar.tsx"
import { PaperLetterDraftingPage } from "@/features/paper/paper-letter-drafting-page.tsx"
import { PaperLetterStartPage } from "@/features/paper/paper-letter-start-page.tsx"
import { SidebarExpandContext } from "@/lib/sidebar-expand.tsx"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { stubDesktopViewport } from "@/test/app-shell-fixtures.ts"
import { render } from "@/test/render-with-client.tsx"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})

function headerOf(button: HTMLElement) {
  return button.closest(
    "header, [data-slot='paper-library-header']"
  ) as HTMLElement | null
}

function staysPut(header: HTMLElement) {
  if (/\bsticky\b/.test(header.className)) return true
  const parent = header.parentElement
  if (
    parent &&
    /\bflex-col\b/.test(parent.className) &&
    /\bshrink-0\b/.test(header.className) &&
    [...parent.children].some(
      (child) =>
        child !== header &&
        /\boverflow-(?:auto|y-auto)\b/.test((child as HTMLElement).className)
    )
  ) {
    return true
  }
  let node: HTMLElement | null = header
  while (node) {
    if (/\b(?:h-full|h-svh|h-dvh)\b/.test(node.className)) return true
    node = node.parentElement
  }
  return false
}

function expectClear(header: HTMLElement) {
  const button = header.querySelector<HTMLElement>(
    "[data-slot='sidebar-expand']"
  )
  expect(button).not.toBeNull()
  expect(button!.className).not.toMatch(/\babsolute\b/)
  const title = header.querySelector(
    "h1, [data-slot='page-header-title'], [data-slot='breadcrumb']"
  )
  expect(title).not.toBeNull()
  expect(
    button!.compareDocumentPosition(title!) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy()
  expect(staysPut(header)).toBe(true)
}

async function collapsedPage(path: string) {
  localStorage.setItem("opencv.sidebar.collapsed", "1")
  stubDesktopViewport(true)
  vi.stubGlobal("scrollTo", vi.fn())
  renderApp(path)
  const buttons = await screen.findAllByRole("button", {
    name: "Expand sidebar",
  })
  expect(buttons.length).toBeGreaterThan(0)
  for (const button of buttons) {
    const header = headerOf(button)
    expect(header).not.toBeNull()
    expectClear(header!)
  }
  cleanup()
}

describe("collapsed expand control stays in the header", () => {
  it.each([
    ["jobs", SURFACE_PATHS.jobs],
    ["apply", SURFACE_PATHS.apply],
    ["inbox", SURFACE_PATHS.inbox],
    ["paper", SURFACE_PATHS.paper],
    ["pitch", SURFACE_PATHS.pitch],
    ["proofs", SURFACE_PATHS.proofs],
  ])("stays clear of the %s header", async (_name, path) => {
    await collapsedPage(path)
  })

  it("stays clear of the letter start, drafting, and CV headers", () => {
    const expand = { collapsed: true, expand: () => {} }
    render(
      <SidebarExpandContext value={expand}>
        <div className="flex h-full min-h-0 flex-col">
          <PaperLetterStartPage onBack={() => {}} onCreated={() => {}} />
        </div>
      </SidebarExpandContext>
    )
    expectClear(
      document.querySelector<HTMLElement>("[data-slot='letter-start-header']")!
    )
    cleanup()

    render(
      <SidebarExpandContext value={expand}>
        <PaperLetterDraftingPage
          draftName="Northwind"
          attribution={null}
          streamedText="Hello"
          onStop={() => {}}
          onBack={() => {}}
        />
      </SidebarExpandContext>
    )
    expectClear(
      document.querySelector<HTMLElement>(
        "[data-slot='letter-drafting-header']"
      )!
    )
    cleanup()

    render(
      <SidebarExpandContext value={expand}>
        <div className="flex h-full min-h-0 flex-col">
          <CvEditorBar
            name="CV"
            favorite={false}
            favoritePending={false}
            shareLink="https://opencv.example/cv"
            statusLabel="Saved"
            onBack={() => {}}
            onName={() => {}}
            onCommitName={() => {}}
            onFavorite={() => {}}
            onGallery={() => {}}
            onPrint={() => {}}
            onCoach={() => {}}
            onUndo={() => {}}
          />
          <div className="min-h-0 flex-1 overflow-auto" />
        </div>
      </SidebarExpandContext>
    )
    expectClear(
      document.querySelector<HTMLElement>("[data-slot='cv-editor-header']")!
    )
  })

  it("puts the control first in the letter editor header without editing the writing header", () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const letter = readFileSync(join(here, "../paper/paper-letter.tsx"), "utf8")
    const header = letter.slice(
      letter.indexOf('data-slot="letter-editor-header"'),
      letter.indexOf('data-slot="letter-editor-desk"')
    )
    expect(header.indexOf("<SidebarExpandButton")).toBeGreaterThan(-1)
    expect(header.indexOf("<SidebarExpandButton")).toBeLessThan(
      header.indexOf("<Breadcrumb")
    )

    const writing = readFileSync(
      join(here, "../paper/writing-page.tsx"),
      "utf8"
    )
    expect(writing).toContain("<PageHeader")
    expect(writing).toContain('data-slot="writing-document-header"')
    expect(writing).not.toContain("SidebarExpandButton")
  })
})
