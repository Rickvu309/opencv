import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { emptyCvDocument } from "@workspace/domain"

import { PaperCvEditor } from "./paper-editor.tsx"
import type { PaperPages, PaperRecord } from "./paper-api.ts"

const record: PaperRecord = {
  id: "doc-1",
  name: "PM track CV",
  kind: "cv",
  templateId: "simple",
  status: "draft",
  document: emptyCvDocument(),
  contentVersion: 1,
  checks: [],
  pageChoice: "unset",
  sourceFileId: null,
  applyCardId: null,
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
}

function pages(count: number): PaperPages {
  return { docId: record.id, pages: count, pageChoice: "unset" }
}

function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

function fail(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status })
}

function installFetch(conflict = false) {
  const calls: string[] = []
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    if (url.includes("/api/commands/paper.replace")) {
      if (conflict) {
        return Promise.resolve(
          fail(
            409,
            "CONFLICT",
            "This document changed. Reload it and try again."
          )
        )
      }
      return Promise.resolve(ok({ ...record, contentVersion: 2 }))
    }
    if (url.includes("/api/commands/paper.share")) {
      return Promise.resolve(ok({ token: "tok" }))
    }
    if (url.includes("/api/commands/paper.keepTwoPages")) {
      return Promise.resolve(ok({ ...record, pageChoice: "keep" }))
    }
    return Promise.resolve(ok({}))
  })
  return calls
}

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  vi.unstubAllGlobals()
})

describe("CV editor chrome", () => {
  it("shows Edited just now after a save and copies the share link", async () => {
    const calls = installFetch()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(
      <PaperCvEditor
        initial={record}
        pages={pages(1)}
        onBack={() => undefined}
      />
    )
    expect(screen.queryByText("Edited just now")).not.toBeInTheDocument()

    const summary = screen.getByRole("textbox", { name: "Summary" })
    vi.useFakeTimers()
    summary.textContent = "Edited for verify."
    fireEvent.input(summary)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })

    expect(screen.getByText("Edited just now")).toBeInTheDocument()
    expect(
      calls.some((url) => url.includes("/api/commands/paper.replace"))
    ).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(calls.some((url) => url.includes("/api/commands/paper.share"))).toBe(
      true
    )
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/share/tok`
    )
  })

  it("keeps two pages and shows a conflict", async () => {
    const calls = installFetch(true)
    render(
      <PaperCvEditor
        initial={record}
        pages={pages(2)}
        onBack={() => undefined}
      />
    )
    expect(
      screen.getByRole("button", { name: "Fit to one page" })
    ).toBeInTheDocument()
    expect(screen.getByText("Page 2")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Keep 2 pages" }))
    await vi.waitFor(() => {
      expect(
        calls.some((url) => url.includes("/api/commands/paper.keepTwoPages"))
      ).toBe(true)
      expect(
        screen.queryByRole("button", { name: "Fit to one page" })
      ).not.toBeInTheDocument()
    })

    const summary = screen.getByRole("textbox", { name: "Summary" })
    vi.useFakeTimers()
    summary.textContent = "A conflicting edit."
    fireEvent.input(summary)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(
      screen.getByRole("region", { name: "Document changed" })
    ).toBeInTheDocument()
  })
})
