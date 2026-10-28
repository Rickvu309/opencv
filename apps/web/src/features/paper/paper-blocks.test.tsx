import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { BLOCK_TYPES, blockRegistry, type PaperPages, type PaperView } from "@workspace/domain"

import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"
import { subscribeCoachDraft, takeCoachDraft } from "@/lib/coach-draft.ts"
import { render as renderWithClient } from "@/test/render-with-client.tsx"

import { blockFields } from "./paper-block-fields.tsx"
import { blockMakerKeys, blockMakers } from "./paper-block-ops.ts"
import { PaperCvEditor } from "./paper-editor.tsx"
import { SLASH_ITEMS } from "./paper-slash-menu.tsx"

function render(ui: ReactElement) {
  const wrap = (content: ReactElement) => (
    <ChatStoreProvider>{content}</ChatStoreProvider>
  )
  const view = renderWithClient(wrap(ui))
  return {
    ...view,
    rerender: (next: ReactElement) => view.rerender(wrap(next)),
  }
}

const record: PaperView = {
  id: "doc-1",
  name: "PM track CV",
  kind: "cv",
  templateId: "simple",
  status: "draft",
  document: {
    version: 2,
    header: { name: "Ada", email: "", phone: "", city: "", linkedin: "" },
    sections: [
      {
        id: "section-experience",
        kind: "experience",
        blocks: [
          { id: "a", type: "text", text: "Alpha" },
          { id: "b", type: "text", text: "Beta" },
        ],
      },
    ],
  },
  contentVersion: 1,
  checks: [],
  pageChoice: "unset",
  sourceFileId: null,
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
}

const pages: PaperPages = { docId: record.id, pages: 1, pageChoice: "unset" }

function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

const originalRect = HTMLElement.prototype.getBoundingClientRect

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = originalRect
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function box(top: number, height: number, width = 240): DOMRect {
  return {
    x: 0,
    y: top,
    left: 0,
    top,
    right: width,
    bottom: top + height,
    width,
    height,
    toJSON() {
      return {}
    },
  } as DOMRect
}

async function key(target: EventTarget, code: string) {
  await act(async () => {
    fireEvent.keyDown(target, { code, key: code === "Space" ? " " : code })
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe("block editor", () => {
  it("maps every block type to a field and a maker", () => {
    expect(Object.keys(blockFields).sort()).toEqual([...BLOCK_TYPES].sort())
    expect(blockMakerKeys().sort()).toEqual([...BLOCK_TYPES].sort())
  })

  it("opens Insert from an empty block and inserts a section", () => {
    vi.stubGlobal("fetch", () => Promise.resolve(ok({})))
    render(
      <PaperCvEditor
        initial={{ ...record, document: { ...record.document, version: 2, sections: [] } }}
        pages={pages}
        onBack={() => undefined}
      />
    )
    const impact = screen.getByRole("textbox", {
      name: "What you did, and what changed because of it",
    })
    fireEvent.keyDown(impact, { key: "/" })
    expect(screen.getByRole("listbox", { name: "Insert" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "CV sections" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Blocks" })).toBeInTheDocument()
    const filter = screen.getByRole("textbox", { name: "Type to filter" })
    fireEvent.keyDown(filter, { key: "ArrowDown" })
    fireEvent.keyDown(filter, { key: "Enter" })
    expect(document.querySelector("[data-section='projects']")).not.toBeNull()
    expect(impact.textContent).toBe("")
    expect(screen.queryByRole("listbox", { name: "Insert" })).not.toBeInTheDocument()
  })

  it("opens the slash menu upward near the bottom of a short window", () => {
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(390)
    HTMLElement.prototype.getBoundingClientRect = () => box(300, 40)
    vi.stubGlobal("fetch", () => Promise.resolve(ok({})))
    render(
      <PaperCvEditor
        initial={{
          ...record,
          document: {
            version: 2,
            header: { name: "", email: "", phone: "", city: "", linkedin: "" },
            sections: [
              {
                id: "section-experience",
                kind: "experience",
                blocks: [{ id: "a", type: "text", text: "" }],
              },
            ],
          },
        }}
        pages={pages}
        onBack={() => undefined}
      />
    )
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Text" }), { key: "/" })
    expect(screen.getByRole("listbox", { name: "Insert" }).className).toContain(
      "bottom-full"
    )
  })

  it("lists block menu actions and asks Coach with the block text", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/commands/chat.open")) {
        return Promise.resolve(ok({ id: "chat-1" }))
      }
      return Promise.resolve(ok({}))
    })
    render(<PaperCvEditor initial={record} pages={pages} onBack={() => undefined} />)
    fireEvent.click(screen.getAllByRole("button", { name: "Block menu" })[0]!)
    expect(await screen.findByRole("menuitem", { name: "Turn into" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: /Duplicate/ })).toHaveTextContent("⌘ D")
    expect(screen.getByRole("menuitem", { name: /Move up/ })).toHaveTextContent("⌘ ⇧ ↑")
    expect(screen.getByRole("menuitem", { name: /Move down/ })).toHaveTextContent("⌘ ⇧ ↓")
    expect(screen.getByRole("menuitem", { name: /Delete/ })).toHaveTextContent("Del")
    let taken: string | null = null
    const stop = subscribeCoachDraft(() => {
      taken = takeCoachDraft()
    })
    fireEvent.click(screen.getByRole("menuitem", { name: "Ask Coach" }))
    await vi.waitFor(() => {
      expect(taken).toBe("Alpha")
    })
    stop()
  })

  it("undoes a delete", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(ok({ ...record, contentVersion: 2 }))
    )
    render(<PaperCvEditor initial={record} pages={pages} onBack={() => undefined} />)
    fireEvent.click(screen.getAllByRole("button", { name: "Block menu" })[0]!)
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }))
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    expect(screen.getByText("Alpha")).toBeInTheDocument()
  })

  it("saves one new order when a drag ends", async () => {
    HTMLElement.prototype.getBoundingClientRect = function () {
      const id = this.getAttribute("data-sortable-block")
      if (id === "a") return box(48, 40)
      if (id === "b") return box(160, 40)
      if (this.querySelector(":scope > h2")) return box(0, 24)
      return box(0, 2000, 1440)
    }
    const bodies: {
      input?: { document?: { sections?: { blocks?: { id: string }[] }[] } }
    }[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/commands/paper.replace")) {
        bodies.push(JSON.parse(String(init?.body)) as (typeof bodies)[number])
        return Promise.resolve(ok({ ...record, contentVersion: 2 }))
      }
      return Promise.resolve(ok({}))
    })
    render(<PaperCvEditor initial={record} pages={pages} onBack={() => undefined} />)
    const handle = screen.getAllByRole("button", { name: "Block menu" })[0]!
    handle.focus()
    await key(handle, "Space")
    await key(document, "ArrowDown")
    await key(document, "Space")
    expect(bodies).toHaveLength(1)
    expect(
      bodies[0]?.input?.document?.sections?.[0]?.blocks?.map((block) => block.id)
    ).toEqual(["b", "a"])
  })

  it("does not set a reorder transform when reduced motion is on", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false
      },
      onchange: null,
    }))
    vi.stubGlobal("fetch", () => Promise.resolve(ok({})))
    render(<PaperCvEditor initial={record} pages={pages} onBack={() => undefined} />)
    const node = document.querySelector("[data-sortable-block]")
    expect(node?.getAttribute("style") ?? "").not.toMatch(/transform/)
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
  })

  it("keeps one tab stop on the block", () => {
    vi.stubGlobal("fetch", () => Promise.resolve(ok({})))
    render(<PaperCvEditor initial={record} pages={pages} onBack={() => undefined} />)
    const block = document.querySelector("[data-sortable-block='a']")
    expect(block).toHaveAttribute("tabindex", "0")
    for (const inner of block?.querySelectorAll("button, [role='textbox']") ?? []) {
      expect(inner).toHaveAttribute("tabindex", "-1")
    }
    fireEvent.keyDown(block!, { key: "d", metaKey: true })
    expect(screen.getAllByText("Alpha").length).toBeGreaterThan(1)
  })

  it("restores the document after duplicate", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(ok({ ...record, contentVersion: 2 }))
    )
    render(<PaperCvEditor initial={record} pages={pages} onBack={() => undefined} />)
    fireEvent.click(screen.getAllByRole("button", { name: "Block menu" })[0]!)
    fireEvent.click(await screen.findByRole("menuitem", { name: /Duplicate/ }))
    expect(screen.getAllByText("Alpha")).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    expect(screen.getAllByText("Alpha")).toHaveLength(1)
  })

  it("does not save a delete of an unsaved draft", async () => {
    const bodies: unknown[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/commands/paper.replace")) {
        bodies.push(init?.body)
      }
      return Promise.resolve(ok({ ...record, contentVersion: 2 }))
    })
    render(
      <PaperCvEditor
        initial={{ ...record, document: { ...record.document, version: 2, sections: [] } }}
        pages={pages}
        onBack={() => undefined}
      />
    )
    fireEvent.click(screen.getAllByRole("button", { name: "Block menu" })[0]!)
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }))
    expect(bodies).toEqual([])
  })

  it("moves a block down and up and deletes it with the Delete key", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(ok({ ...record, contentVersion: 2 }))
    )
    render(<PaperCvEditor initial={record} pages={pages} onBack={() => undefined} />)
    fireEvent.click(screen.getAllByRole("button", { name: "Block menu" })[0]!)
    fireEvent.click(await screen.findByRole("menuitem", { name: /Move down/ }))
    const afterDown = screen
      .getAllByRole("textbox", { name: "Text" })
      .map((node) => node.textContent)
    expect(afterDown.slice(0, 2)).toEqual(["Beta", "Alpha"])
    fireEvent.click(screen.getAllByRole("button", { name: "Block menu" })[1]!)
    fireEvent.click(await screen.findByRole("menuitem", { name: /Move up/ }))
    expect(
      screen.getAllByRole("textbox", { name: "Text" }).map((node) => node.textContent).slice(0, 2)
    ).toEqual(["Alpha", "Beta"])
    const block = document.querySelector("[data-sortable-block='a']")
    block?.focus()
    fireEvent.keyDown(block!, { key: "Delete" })
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument()
  })

  it("builds slash blocks from the registry empty blocks", () => {
    const labels = SLASH_ITEMS.filter((item) => item.group === "block").map(
      (item) => item.label
    )
    expect(labels).toEqual(
      blockRegistry.flatMap((entry) => (entry.slash ? [entry.slash.label] : []))
    )
    for (const entry of blockRegistry) {
      expect(blockMakers[entry.type]()).toEqual(entry.empty())
    }
  })

  it("does not undo across a Coach save", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(ok({ ...record, contentVersion: 2 }))
    )
    const view = render(
      <PaperCvEditor initial={record} pages={pages} onBack={() => undefined} />
    )
    fireEvent.click(screen.getAllByRole("button", { name: "Block menu" })[0]!)
    fireEvent.click(await screen.findByRole("menuitem", { name: /Duplicate/ }))
    expect(screen.getAllByText("Alpha")).toHaveLength(2)
    await act(async () => {
      await Promise.resolve()
    })
    view.rerender(
      <PaperCvEditor
        initial={{
          ...record,
          contentVersion: 5,
          document: {
            version: 2,
            header: { name: "Ada", email: "", phone: "", city: "", linkedin: "" },
            sections: [
              {
                id: "section-experience",
                kind: "experience",
                blocks: [{ id: "a", type: "text", text: "Coach kept" }],
              },
            ],
          },
        }}
        pages={pages}
        onBack={() => undefined}
      />
    )
    expect(screen.getByText("Coach kept")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    expect(screen.getByText("Coach kept")).toBeInTheDocument()
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument()
  })

  it("opens the block menu upward near the bottom of a short window", async () => {
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(390)
    HTMLElement.prototype.getBoundingClientRect = () => box(300, 40)
    vi.stubGlobal("fetch", () => Promise.resolve(ok({})))
    render(<PaperCvEditor initial={record} pages={pages} onBack={() => undefined} />)
    const menu = screen.getAllByRole("button", { name: "Block menu" })[0]!
    fireEvent.focus(menu)
    fireEvent.click(menu)
    const popup = await screen.findByRole("menu")
    expect(popup.getAttribute("data-side") ?? popup.className).toMatch(/top/)
  })
})
