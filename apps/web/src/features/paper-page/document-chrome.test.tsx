import { afterEach, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRef } from "react"
import { render } from "@/test/render-with-client.tsx"
import {
  PaperDocumentCanvas,
  PaperDocumentHeader,
  PaperDocumentTitle,
} from "./document-chrome.tsx"
import { PaperDocumentOutline } from "./document-outline.tsx"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it("keeps Paper navigation and all unsaved status words while showing the saved date", () => {
  const back = vi.fn()
  const view = render(
    <PaperDocumentHeader
      name="My Letter"
      kind="letter"
      status="Saved"
      onBack={back}
    />
  )
  expect(screen.getByRole("status")).toHaveTextContent("Edited just now")
  expect(screen.getByRole("status")).toHaveAttribute("title", "Saved")
  expect(screen.getByRole("link", { name: "Letters" })).toHaveAttribute(
    "href",
    "/paper?tab=letters"
  )
  fireEvent.click(screen.getByRole("link", { name: "Back to Paper" }))
  expect(back).toHaveBeenCalledOnce()
  view.rerender(
    <PaperDocumentHeader name="My Letter" status="Not saved — offline" />
  )
  expect(screen.getByRole("status")).toHaveTextContent("Not saved — offline")
})

it("renames through the product command and cancels an unfinished name with Escape", async () => {
  const requests: unknown[] = []
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    if (!String(url).includes("paper.rename")) throw new Error(String(url))
    requests.push(JSON.parse(String(init?.body)))
    return Response.json({ ok: true, data: {} })
  })
  render(
    <PaperDocumentTitle
      name="My CV"
      docId="16590000-0000-4000-8000-000000000001"
    />
  )
  fireEvent.click(screen.getByRole("button", { name: "Rename document" }))
  fireEvent.change(screen.getByRole("textbox", { name: "Document name" }), {
    target: { value: "Designer CV" },
  })
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" })
  await screen.findByRole("heading", { name: "Designer CV" })
  expect(requests).toEqual([
    expect.objectContaining({
      input: expect.objectContaining({ name: "Designer CV" }),
    }),
  ])
  fireEvent.click(screen.getByRole("button", { name: "Rename document" }))
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Discard" },
  })
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" })
  expect(screen.getByRole("heading", { name: "Designer CV" })).toBeVisible()
  expect(requests).toHaveLength(1)
})

it("aligns the title with the page even when the editor injects a style sibling", async () => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 816, 1056)
  )
  const view = render(
    <PaperDocumentCanvas
      title={<PaperDocumentTitle name="My CV" docId="invalid" />}
    >
      <div data-paper-page-viewport>
        <style />
        <article className="paper-rich-sheet" style={{ padding: 96 }} />
      </div>
    </PaperDocumentCanvas>
  )
  await waitFor(() =>
    expect(view.container.querySelector(".paper-document-title")).toHaveStyle({
      width: "816px",
      paddingInlineStart: "96px",
    })
  )
})

it("opens the outline for headings and scrolls the chosen heading with the keyboard", async () => {
  const host = createRef<HTMLDivElement>()
  const scroll = vi.fn()
  const view = render(
    <div>
      <div ref={host}>
        <div data-content-type="heading">Summary</div>
        <div data-content-type="heading">Experience</div>
        <div data-content-type="heading">Education</div>
      </div>
      <PaperDocumentOutline host={host} />
    </div>
  )
  const heading = view.container.querySelectorAll<HTMLElement>(
    "[data-content-type=heading]"
  )[2]!
  heading.scrollIntoView = scroll
  const outline = await screen.findByRole("navigation", { name: "Outline" })
  const trigger = within(outline).getByRole("button", {
    name: "Document outline",
  })
  fireEvent.focus(trigger)
  fireEvent.click(trigger)
  const item = await screen.findByRole("button", { name: "Education" })
  item.focus()
  await userEvent.setup().keyboard("{Enter}")
  expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "instant" })
  view.rerender(
    <div>
      <div ref={host}>
        <div data-content-type="heading">Summary</div>
      </div>
      <PaperDocumentOutline host={host} />
    </div>
  )
  await waitFor(() =>
    expect(screen.queryByRole("navigation", { name: "Outline" })).toBeNull()
  )
})
