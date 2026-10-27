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

    const impact = screen.getByRole("textbox", {
      name: "What you did, and what changed because of it",
    })
    vi.useFakeTimers()
    impact.textContent = "Edited for verify."
    fireEvent.input(impact)
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

    const impact = screen.getByRole("textbox", {
      name: "What you did, and what changed because of it",
    })
    vi.useFakeTimers()
    impact.textContent = "A conflicting edit."
    fireEvent.input(impact)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(
      screen.getByRole("region", { name: "Document changed" })
    ).toBeInTheDocument()
  })

  it("shows page 2 when a later read says keep", () => {
    const view = render(
      <PaperCvEditor
        initial={{ ...record, pageChoice: "keep" }}
        pages={{ docId: record.id, pages: 1, pageChoice: "keep" }}
        onBack={() => undefined}
      />
    )
    expect(screen.queryByText("Page 2")).not.toBeInTheDocument()
    view.rerender(
      <PaperCvEditor
        initial={{ ...record, pageChoice: "keep" }}
        pages={{ docId: record.id, pages: 2, pageChoice: "keep" }}
        onBack={() => undefined}
      />
    )
    expect(screen.getByText("Page 2")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Fit to one page" })
    ).not.toBeInTheDocument()
  })

  it("shows blank CV placeholders and does not save them", () => {
    installFetch()
    render(
      <PaperCvEditor
        initial={record}
        pages={pages(1)}
        onBack={() => undefined}
      />
    )
    for (const label of [
      "Email",
      "Phone",
      "City",
      "LinkedIn",
      "Role, company",
      "Dates",
      "What you did, and what changed because of it",
      "School, degree",
      "Tools, software and languages",
    ]) {
      const field = screen.getByRole("textbox", { name: label })
      expect(field).toHaveAttribute("data-placeholder", label)
      expect(field.textContent).toBe("")
    }
    expect(screen.getByRole("textbox", { name: "Role, company" })).toHaveClass(
      "block"
    )
    expect(screen.getByRole("textbox", { name: "Dates" })).toHaveClass("block")
  })

  it("does not send a stale version when a conflict lands between two edits", async () => {
    const bodies: { contentVersion: number }[] = []
    let replaceCount = 0
    let release: (value: Response) => void = () => undefined
    const gate = new Promise<Response>((resolve) => {
      release = resolve
    })
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/commands/paper.replace")) {
        replaceCount += 1
        bodies.push(
          JSON.parse(String(init?.body)) as { contentVersion: number }
        )
        if (replaceCount === 1) return gate
        return Promise.resolve(ok({ ...record, contentVersion: 3 }))
      }
      if (url.includes(`/api/paper/${record.id}`)) {
        return Promise.resolve(
          ok({
            ...record,
            contentVersion: 4,
            document: { ...emptyCvDocument(), summary: "Server text" },
          })
        )
      }
      return Promise.resolve(ok({}))
    })

    render(
      <PaperCvEditor
        initial={record}
        pages={pages(1)}
        onBack={() => undefined}
      />
    )
    const impact = screen.getByRole("textbox", {
      name: "What you did, and what changed because of it",
    })
    vi.useFakeTimers()
    impact.textContent = "First"
    fireEvent.input(impact)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(replaceCount).toBe(1)
    expect(bodies[0]?.contentVersion).toBe(1)

    impact.textContent = "Second"
    fireEvent.input(impact)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(replaceCount).toBe(1)

    await act(async () => {
      release(
        fail(409, "CONFLICT", "This document changed. Reload it and try again.")
      )
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(replaceCount).toBe(1)
    expect(bodies.map((body) => body.contentVersion)).toEqual([1])

    const reload = screen.getByRole("button", { name: "Reload" })
    reload.focus()
    fireEvent.click(reload)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(
      screen.getByRole("textbox", { name: "Server text" }).textContent
    ).toBe("Server text")
    expect(replaceCount).toBe(1)
  })

  it("sets the open CV template from the gallery", async () => {
    const bodies: { docId?: string; templateId?: string }[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/commands/paper.setTemplate")) {
        bodies.push(
          JSON.parse(String(init?.body)) as {
            docId?: string
            templateId?: string
          }
        )
        return Promise.resolve(
          ok({ ...record, templateId: "modern", contentVersion: 2 })
        )
      }
      return Promise.resolve(ok({}))
    })
    const view = render(
      <PaperCvEditor
        initial={record}
        pages={pages(1)}
        onBack={() => undefined}
      />
    )
    expect(
      view.container
        .querySelector("[data-paper-editor] [data-template]")
        ?.getAttribute("data-template")
    ).toBe("simple")
    fireEvent.click(screen.getByRole("button", { name: "Change template" }))
    fireEvent.click(screen.getByRole("button", { name: "Modern" }))
    fireEvent.click(screen.getByRole("button", { name: "Use template" }))
    await vi.waitFor(() => {
      expect(bodies).toEqual([{ docId: record.id, templateId: "modern" }])
      expect(
        view.container
          .querySelector("[data-paper-editor] [data-template]")
          ?.getAttribute("data-template")
      ).toBe("modern")
    })
  })
})
