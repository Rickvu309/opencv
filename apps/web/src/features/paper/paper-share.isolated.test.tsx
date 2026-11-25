import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  blankCv,
  paperDocumentSchema,
  type LetterPaper,
  type PaperDocument,
  type PaperSharedView,
} from "@workspace/domain"
import { StrictMode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"

import { PaperSharePage } from "@/features/paper/paper-share-page.tsx"
import { render } from "@/test/render-with-client.tsx"

const state = vi.hoisted(() => ({ pathname: "/share/tok" }))

vi.mock("@tanstack/react-router", () => ({
  useRouterState: (options: {
    select: (routerState: { location: { pathname: string } }) => unknown
  }) => options.select({ location: { pathname: state.pathname } }),
}))

function letterPaper(lines: string[]): PaperDocument {
  return paperDocumentSchema.parse({
    version: 3,
    kind: "letter",
    clashes: [],
    blocks: lines.map((text, index) => ({
      id: `l-${index + 1}`,
      type: "paragraph",
      content: [{ text }],
    })),
  })
}

const shared: PaperSharedView = {
  id: "doc-1",
  name: "PM track CV",
  kind: "cv",
  templateId: "modern",
  paper: blankCv(),
}

function mountLetterStyles() {
  const css = readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "design/letter-sheet.css"
    ),
    "utf8"
  )
  const style = document.createElement("style")
  style.setAttribute("data-test-letter", "")
  style.textContent = `ul,ol{list-style:none;padding:0}a{text-decoration-line:none}h2,h3{font-size:11px;font-weight:400}${css}`
  document.head.append(style)
}

afterEach(() => {
  document.body.removeAttribute("data-print")
  document.querySelector("[data-test-letter]")?.remove()
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  state.pathname = "/share/tok"
})

describe("Paper share page", () => {
  it("prints the row template when the body still says internship", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/paper/shared/tok")) {
        return Promise.resolve(Response.json({ ok: true, data: shared }))
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })
    const view = render(<PaperSharePage />)
    expect(
      await screen.findByRole("heading", { name: "PM track CV" })
    ).toBeInTheDocument()
    expect(view.container.querySelector(".cv-template-product")).not.toBeNull()
    expect(view.container.querySelector(".cv-template-internship")).toBeNull()
  })

  it("prints the shared template from Download PDF", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/paper/shared/tok")) {
        return Promise.resolve(Response.json({ ok: true, data: shared }))
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      expect(document.body).toHaveAttribute("data-print", "paper")
      expect(
        document.querySelector("[data-paper-print] .cv-template-product")
      ).not.toBeNull()
      window.dispatchEvent(new Event("afterprint"))
    })
    render(<PaperSharePage />)
    fireEvent.click(await screen.findByRole("button", { name: "Download PDF" }))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(print).toHaveBeenCalledTimes(1)
  })

  it("shows no placeholder for an empty summary or an empty company", async () => {
    const quietPaper = paperDocumentSchema.parse({
      version: 3,
      kind: "cv",
      header: {
        id: "header",
        type: "header",
        name: "Ada",
        email: "",
        phone: "",
        city: "",
        linkedin: "",
      },
      clashes: [],
      blocks: [
        {
          id: "section-experience",
          type: "section",
          kind: "experience",
          title: "Experience",
        },
        {
          id: "role-1",
          type: "experience",
          role: "Product intern",
          company: "",
          period: "2024",
          location: "",
          children: [
            {
              id: "b1",
              type: "bullet",
              content: [{ text: "Shipped the checklist" }],
              children: [],
            },
          ],
        },
      ],
    })
    const quiet: Omit<PaperView, "isFavorite"> = {
      ...shared,
      templateId: "simple",
      paper: quietPaper,
    }
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/paper/shared/tok")) {
        return Promise.resolve(Response.json({ ok: true, data: quiet }))
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })
    render(<PaperSharePage />)
    expect(
      await screen.findByRole("heading", { name: "PM track CV" })
    ).toBeInTheDocument()
    const preview = document.querySelector("[data-paper-quiet]")
    expect(preview).not.toBeNull()
    expect(preview?.innerHTML ?? "").not.toContain("Add text")
    expect(preview?.querySelector("[aria-label='Company']")).toHaveAttribute(
      "hidden"
    )
    expect(preview?.querySelector("[aria-label='Summary']")).toBeNull()
  })

  it("shows a shared letter's words as flat paragraphs", async () => {
    const letter: Omit<PaperView, "isFavorite"> = {
      ...shared,
      name: "Letter for Ada",
      kind: "letter",
      templateId: null,
      paper: letterPaper(["Ada", "May 5", "First.", "Second.", "Ada"]),
    }
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/paper/shared/tok")) {
        return Promise.resolve(Response.json({ ok: true, data: letter }))
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })
    render(<PaperSharePage />)
    expect(
      await screen.findByRole("heading", { name: "Letter for Ada" })
    ).toBeInTheDocument()
    const sheet = document.querySelector(
      "[data-paper-quiet] [data-slot='letter-sheet']"
    )
    expect(sheet).not.toBeNull()
    expect(
      [...(sheet?.children ?? [])].map((node) => node.textContent)
    ).toEqual(["Ada", "May 5", "First.", "Second.", "Ada"])
    expect(sheet?.querySelector("[data-slot='letter-sender']")).toBeNull()
    expect(
      sheet?.querySelector("[data-slot='letter-paragraph']")
    ).not.toBeNull()
    expect(sheet?.querySelector("textarea, [placeholder]")).toBeNull()
  })

  it("shows heading levels, list markers and the link on a shared letter", async () => {
    mountLetterStyles()
    const paper: LetterPaper = {
      version: 3,
      kind: "letter",
      clashes: [],
      blocks: [
        {
          id: "h2",
          type: "heading",
          level: 2,
          content: [{ text: "Why Northwind" }],
        },
        {
          id: "h3",
          type: "heading",
          level: 3,
          content: [{ text: "The work" }],
        },
        {
          id: "b1",
          type: "bullet",
          content: [{ text: "Brought the board" }],
          children: [],
        },
        {
          id: "n1",
          type: "numbered",
          content: [{ text: "First step" }],
          children: [],
        },
        {
          id: "p1",
          type: "paragraph",
          content: [
            { text: "See " },
            { text: "Acme", href: "https://acme.example" },
          ],
        },
      ],
    }
    const letter: Omit<PaperView, "isFavorite"> = {
      ...shared,
      name: "Letter for Ada",
      kind: "letter",
      templateId: null,
      paper,
    }
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/paper/shared/tok")) {
        return Promise.resolve(Response.json({ ok: true, data: letter }))
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })
    render(<PaperSharePage />)
    const heading = await screen.findByRole("heading", {
      level: 2,
      name: "Why Northwind",
    })
    const subheading = screen.getByRole("heading", {
      level: 3,
      name: "The work",
    })
    const lists = screen.getAllByRole("list")
    const bullet = lists.find((node) => node.tagName === "UL")
    const numbered = lists.find((node) => node.tagName === "OL")
    const link = screen.getByRole("link", { name: "Acme" })
    expect(bullet).toBeDefined()
    expect(numbered).toBeDefined()
    expect(link).toHaveAttribute("href", "https://acme.example")
    expect(getComputedStyle(heading).fontWeight).toBe("700")
    expect(getComputedStyle(heading).fontSize).toBe("15px")
    expect(getComputedStyle(subheading).fontWeight).toBe("700")
    expect(getComputedStyle(subheading).fontSize).toBe("13px")
    expect(getComputedStyle(bullet!).listStyleType).toBe("disc")
    expect(getComputedStyle(numbered!).listStyleType).toBe("decimal")
    expect(getComputedStyle(link).textDecorationLine).toContain("underline")
  })

  it("prints once in strict mode and unmounts the share sheet", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/paper/shared/tok")) {
        return Promise.resolve(Response.json({ ok: true, data: shared }))
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined)
    render(
      <StrictMode>
        <PaperSharePage />
      </StrictMode>
    )
    fireEvent.click(await screen.findByRole("button", { name: "Download PDF" }))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(print).toHaveBeenCalledTimes(1)
    expect(document.querySelector("[data-paper-print]")).not.toBeNull()
    act(() => {
      window.dispatchEvent(new Event("afterprint"))
    })
    expect(document.querySelector("[data-paper-print]")).toBeNull()
  })
})
