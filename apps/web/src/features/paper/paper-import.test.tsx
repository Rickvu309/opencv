import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { render as renderWithClient } from "@/test/render-with-client.tsx"
import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"
import type { PaperPages, PaperView } from "@workspace/domain"

import { PaperCvEditor } from "./paper-editor.tsx"

function render(ui: ReactElement) {
  return renderWithClient(<ChatStoreProvider>{ui}</ChatStoreProvider>)
}

const cvDocument = {
  version: 2 as const,
  header: { name: "Ada", email: "", phone: "", city: "", linkedin: "" },
  sections: [
    {
      id: "exp",
      kind: "experience" as const,
      blocks: [
        {
          id: "entry",
          type: "experience-entry" as const,
          role: "Lead",
          company: "UIT",
          period: "",
          bullets: [],
        },
      ],
    },
  ],
}

const checks = [
  {
    id: "source-file",
    kind: "source",
    message: "sample.pdf",
    resolved: true,
  },
  {
    id: "phone",
    kind: "phone",
    message: "No phone number in your file.",
    blockId: "header.phone",
    resolved: false,
  },
  {
    id: "dates",
    kind: "dates",
    message: "Add when you did this role.",
    blockId: "entry",
    resolved: false,
  },
]

const record: PaperView = {
  id: "doc-1",
  name: "sample",
  kind: "cv",
  templateId: "simple",
  status: "draft",
  document: cvDocument,
  contentVersion: 1,
  checks,
  pageChoice: "unset",
  isFavorite: false,
  sourceFileId: null,
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
}

const pages: PaperPages = { docId: record.id, pages: 1, pageChoice: "unset" }

function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

type Call = { url: string; input: { checkId?: string } }

function installFetch(initial: PaperView = record) {
  const calls: Call[] = []
  let current = initial
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body = init?.body
      ? (JSON.parse(String(init.body)) as { input?: { checkId?: string } })
      : {}
    const command = body.input ?? {}
    calls.push({ url, input: command })
    if (url.includes("/api/commands/paper.dismissCheck")) {
      current = {
        ...current,
        checks: current.checks.filter((check) => check.id !== command.checkId),
        updatedAt: "2026-10-28T00:00:00.000Z",
      }
      return Promise.resolve(ok(current))
    }
    if (url.includes("/api/commands/paper.replace")) {
      current = { ...current, contentVersion: current.contentVersion + 1 }
      return Promise.resolve(ok(current))
    }
    return Promise.resolve(ok({}))
  })
  return calls
}

function editor(initial: PaperView = record) {
  return (
    <PaperCvEditor initial={initial} pages={pages} onBack={() => undefined} />
  )
}

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  vi.unstubAllGlobals()
})

describe("import check bar", () => {
  it("names the file, counts open checks, and focuses phone and dates", () => {
    installFetch()
    render(editor())
    expect(screen.getByText("Imported from sample.pdf")).toBeInTheDocument()
    expect(screen.getByText("2 to check")).toBeInTheDocument()
    expect(screen.getByText("Phone missing")).toBeInTheDocument()
    expect(screen.getByText("Dates missing")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Add phone" }))
    expect(document.activeElement).toHaveAttribute("aria-label", "Phone")

    fireEvent.click(screen.getByRole("button", { name: "Add dates" }))
    expect(document.activeElement).toHaveAttribute("aria-label", "Dates")
    expect(
      document.activeElement?.closest("[data-sortable-block]")
    ).toHaveAttribute("data-sortable-block", "entry")
  })

  it("skips a check through paper.dismissCheck", async () => {
    const calls = installFetch()
    render(editor())
    fireEvent.click(screen.getAllByRole("button", { name: "Skip" })[0]!)
    await act(async () => {
      await Promise.resolve()
    })
    expect(calls.some((call) => call.input.checkId === "phone")).toBe(true)
    expect(screen.queryByText("Phone missing")).not.toBeInTheDocument()
    expect(screen.getByText("1 to check")).toBeInTheDocument()
  })

  it("shows Done at zero open checks and dismisses the source", async () => {
    const calls = installFetch({
      ...record,
      checks: [checks[0]!],
    })
    render(
      editor({
        ...record,
        checks: [checks[0]!],
      })
    )
    expect(screen.queryByText("1 to check")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Done" }))
    await act(async () => {
      await Promise.resolve()
    })
    expect(
      screen.queryByRole("region", { name: "Import checks" })
    ).not.toBeInTheDocument()
    expect(calls.some((call) => call.input.checkId === "source-file")).toBe(
      true
    )
  })

  it("dismisses the phone check after the phone field saves", async () => {
    const calls = installFetch({
      ...record,
      checks: [checks[0]!, checks[1]!],
    })
    render(
      editor({
        ...record,
        checks: [checks[0]!, checks[1]!],
      })
    )
    const phone = screen.getByRole("textbox", { name: "Phone" })
    vi.useFakeTimers()
    phone.textContent = "555 0100"
    fireEvent.input(phone)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(
      calls.some(
        (call) =>
          call.url.includes("paper.dismissCheck") &&
          call.input.checkId === "phone"
      )
    ).toBe(true)
    expect(screen.queryByText("Phone missing")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument()
  })

  it("settles the phone check and leaves dates open until the period has a year", async () => {
    const dated = {
      ...record,
      document: {
        ...cvDocument,
        sections: [
          {
            ...cvDocument.sections[0]!,
            blocks: [
              {
                ...cvDocument.sections[0]!.blocks[0]!,
                period: "Recently",
              },
            ],
          },
        ],
      },
    }
    const calls = installFetch(dated)
    render(editor(dated))
    expect(screen.getByText("Phone missing")).toBeInTheDocument()
    expect(screen.getByText("Dates missing")).toBeInTheDocument()

    vi.useFakeTimers()
    const phone = screen.getByRole("textbox", { name: "Phone" })
    phone.textContent = "555 0100"
    fireEvent.input(phone)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })

    const dismissed = calls
      .filter((call) => call.url.includes("paper.dismissCheck"))
      .map((call) => call.input.checkId)
    expect(dismissed).toEqual(["phone"])
    expect(screen.queryByText("Phone missing")).not.toBeInTheDocument()
    expect(screen.getByText("Dates missing")).toBeInTheDocument()
    expect(screen.getByText("1 to check")).toBeInTheDocument()

    const period = screen.getByRole("textbox", { name: "Period" })
    period.textContent = "2024"
    fireEvent.input(period)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(
      calls.some(
        (call) =>
          call.url.includes("paper.dismissCheck") &&
          call.input.checkId === "dates"
      )
    ).toBe(true)
    expect(screen.queryByText("Dates missing")).not.toBeInTheDocument()
  })
})
