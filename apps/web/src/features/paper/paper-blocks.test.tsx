import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"

import { PaperCvEditor } from "./paper-editor.tsx"
import type { PaperPages, PaperRecord } from "./paper-api.ts"

const blockDocument = {
  version: 2,
  header: { name: "", email: "", phone: "", city: "", linkedin: "" },
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
}

const record: PaperRecord = {
  id: "doc-1",
  name: "PM track CV",
  kind: "cv",
  templateId: "simple",
  status: "draft",
  document: blockDocument,
  contentVersion: 1,
  checks: [],
  pageChoice: "unset",
  sourceFileId: null,
  applyCardId: null,
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
}

const pages: PaperPages = { docId: record.id, pages: 1, pageChoice: "unset" }

const originalRect = HTMLElement.prototype.getBoundingClientRect

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = originalRect
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
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

function installRects() {
  HTMLElement.prototype.getBoundingClientRect = function () {
    const id = this.getAttribute("data-sortable-block")
    if (id === "a") return box(48, 40)
    if (id === "b") return box(160, 40)
    if (this.querySelector(":scope > h2")) return box(0, 24)
    return box(0, 2000, 1440)
  }
}

async function key(target: EventTarget, code: string) {
  await act(async () => {
    fireEvent.keyDown(target, {
      code,
      key: code === "Space" ? " " : code,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe("block drag", () => {
  it("saves the new order once when a drag ends", async () => {
    installRects()
    const bodies: {
      document?: { sections?: { blocks?: { id: string }[] }[] }
    }[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/commands/paper.replace")) {
        bodies.push(JSON.parse(String(init?.body)) as (typeof bodies)[number])
        return Promise.resolve(
          Response.json({ ok: true, data: { ...record, contentVersion: 2 } })
        )
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })
    render(
      <PaperCvEditor initial={record} pages={pages} onBack={() => undefined} />
    )
    const handle = screen.getAllByRole("button", { name: "Block menu" })[0]!
    handle.focus()
    await key(handle, "Space")
    await key(document, "ArrowDown")
    await key(document, "Space")
    expect(bodies).toHaveLength(1)
    expect(
      bodies[0]?.document?.sections?.[0]?.blocks?.map((block) => block.id)
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
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ ok: true, data: {} }))
    )
    render(
      <PaperCvEditor initial={record} pages={pages} onBack={() => undefined} />
    )
    const node = document.querySelector("[data-sortable-block]")
    expect(node?.getAttribute("style") ?? "").not.toMatch(/transform/)
  })
})
