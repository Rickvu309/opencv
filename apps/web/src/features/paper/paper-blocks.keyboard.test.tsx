import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { PaperView } from "@workspace/domain"

import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"
import { render as renderWithClient } from "@/test/render-with-client.tsx"

import { PaperCvEditor } from "./paper-editor.tsx"

const record: PaperView = {
  id: "doc-1",
  name: "PM track CV",
  kind: "cv",
  templateId: "simple",
  status: "draft",
  document: {
    version: 2,
    header: { name: "Ada", email: "", phone: "", city: "", linkedin: "" },
    sections: [],
  },
  contentVersion: 1,
  checks: [],
  pageChoice: "unset",
  sourceFileId: null,
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
}

const pages = { docId: record.id, pages: 1, pageChoice: "unset" as const }

const entryDocument = {
  version: 2 as const,
  header: { name: "", email: "", phone: "", city: "", linkedin: "" },
  sections: [
    {
      id: "exp",
      kind: "experience" as const,
      blocks: [
        {
          id: "entry",
          type: "experience-entry" as const,
          role: "",
          company: "",
          period: "",
          bullets: [],
        },
      ],
    },
  ],
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderEditor() {
  return renderWithClient(
    <ChatStoreProvider>
      <PaperCvEditor
        initial={{ ...record, document: entryDocument }}
        pages={pages}
        onBack={() => undefined}
      />
    </ChatStoreProvider>
  )
}

describe("block editor keyboard", () => {
  it("tabs from Name through the header into the block and through an entry", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ ok: true, data: {} }))
    )
    renderEditor()
    const headerName = screen
      .getByRole("heading", { level: 1 })
      .querySelector("[role='textbox']")
    expect(headerName).toHaveAttribute("aria-label", "Name")
    headerName?.focus()
    await user.tab()
    expect(document.activeElement).toHaveAttribute("aria-label", "Email")
    await user.tab()
    expect(document.activeElement).toHaveAttribute("aria-label", "Phone")
    await user.tab()
    expect(document.activeElement).toHaveAttribute("aria-label", "City")
    await user.tab()
    expect(document.activeElement).toHaveAttribute("aria-label", "LinkedIn")
    await user.tab()
    expect(document.activeElement).toHaveAttribute(
      "data-sortable-block",
      "entry"
    )
    expect(document.activeElement).toHaveAccessibleName("Role, company")
    fireEvent.keyDown(document.activeElement!, { key: "Enter" })
    await vi.waitFor(() => {
      expect(document.activeElement).toHaveAttribute("aria-label", "Role")
    })
    await user.tab()
    expect(document.activeElement).toHaveAttribute("aria-label", "Company")
    await user.tab()
    expect(document.activeElement).toHaveAttribute("aria-label", "Dates")
    await user.tab()
    expect(document.activeElement).toHaveAttribute(
      "aria-label",
      "What you did, and what changed because of it"
    )
    await user.tab()
    expect(document.activeElement).toHaveAttribute("aria-label", "Location")
    fireEvent.keyDown(document.activeElement!, { key: "Escape" })
    expect(document.activeElement).toHaveAttribute(
      "data-sortable-block",
      "entry"
    )
  })

  it("keeps later fields tabbable when focusout still reports the body", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ ok: true, data: {} }))
    )
    renderEditor()
    const block = document.querySelector("[data-sortable-block='entry']")
    fireEvent.keyDown(block!, { key: "Enter" })
    const entry = document.querySelector("[data-sortable-block='entry']")
    const role = entry?.querySelector<HTMLElement>("[aria-label='Role']")
    const company = entry?.querySelector<HTMLElement>("[aria-label='Company']")
    const dates = entry?.querySelector<HTMLElement>("[aria-label='Dates']")
    await vi.waitFor(() => {
      expect(role).toHaveAttribute("tabindex", "0")
    })
    if (!role || !company || !dates) throw new Error("missing entry fields")
    Object.defineProperty(document, "activeElement", {
      configurable: true,
      get: () => document.body,
    })
    try {
      fireEvent.blur(role, { relatedTarget: company })
      await act(async () => {
        await Promise.resolve()
      })
    } finally {
      delete (document as { activeElement?: Element }).activeElement
    }
    expect(dates).toHaveAttribute("tabindex", "0")
    expect(company).toHaveAttribute("tabindex", "0")
  })

  it("keeps Engineer, Northwind in Role and a full first bullet", () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ ok: true, data: {} }))
    )
    renderEditor()
    const role =
      screen.queryByRole("textbox", { name: "Role" }) ??
      screen.getByRole("textbox", { name: "Role, company" })
    role.focus()
    for (const ch of "Engineer, Northwind") {
      const target = document.activeElement
      if (
        !(target instanceof HTMLElement) ||
        target.getAttribute("role") !== "textbox"
      ) {
        break
      }
      target.textContent = `${target.textContent ?? ""}${ch}`
      fireEvent.input(target)
    }
    expect(screen.getByRole("textbox", { name: "Role" }).textContent).toBe(
      "Engineer, Northwind"
    )
    const bullet = screen.getByRole("textbox", {
      name: "What you did, and what changed because of it",
    })
    bullet.focus()
    for (const ch of "Shipped the billing page") {
      const target = document.activeElement
      if (
        !(target instanceof HTMLElement) ||
        target.getAttribute("role") !== "textbox"
      ) {
        break
      }
      target.textContent = `${target.textContent ?? ""}${ch}`
      fireEvent.input(target)
    }
    expect(
      screen.getByRole("textbox", { name: "Bullet point" }).textContent
    ).toBe("Shipped the billing page")
  })
})
