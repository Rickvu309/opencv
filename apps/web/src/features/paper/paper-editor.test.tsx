import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react"
import type { ReactElement } from "react"
import { render as renderWithClient } from "@/test/render-with-client.tsx"
import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"
import {
  emptyCvDocument,
  blankBlockDocument,
  type PaperPages,
  type PaperView,
} from "@workspace/domain"

import { PaperCvEditor } from "./paper-editor.tsx"

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
  document: emptyCvDocument(),
  contentVersion: 1,
  checks: [],
  pageChoice: "unset",
  sourceFileId: null,
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
}

function pages(count: number): PaperPages {
  return { docId: record.id, pages: count, pageChoice: "unset" }
}

function inputOf<T>(init?: RequestInit) {
  return (JSON.parse(String(init?.body)) as { input: T }).input
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

    const role = screen.getByRole("textbox", { name: "Role, company" })
    vi.useFakeTimers()
    role.textContent = "Edited for verify."
    fireEvent.input(role)
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

    const role = screen.getByRole("textbox", { name: "Role, company" })
    vi.useFakeTimers()
    role.textContent = "A conflicting edit."
    fireEvent.input(role)
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
        bodies.push(inputOf<{ contentVersion: number }>(init))
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
    const role = screen.getByRole("textbox", { name: "Role, company" })
    vi.useFakeTimers()
    role.textContent = "First"
    fireEvent.input(role)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(replaceCount).toBe(1)
    expect(bodies[0]?.contentVersion).toBe(1)

    role.textContent = "Second"
    fireEvent.input(role)
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
    expect(screen.getByRole("textbox", { name: "Summary" }).textContent).toBe(
      "Server text"
    )
    expect(replaceCount).toBe(1)
  })

  it("sets the open CV template from the gallery", async () => {
    const bodies: { docId?: string; templateId?: string }[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/commands/paper.setTemplate")) {
        bodies.push(inputOf<{ docId?: string; templateId?: string }>(init))
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

  it("prints the row template when the body still says internship", () => {
    const view = render(
      <PaperCvEditor
        initial={{ ...record, templateId: "modern" }}
        pages={pages(1)}
        onBack={() => undefined}
      />
    )
    expect(
      view.container
        .querySelector("[data-paper-editor] [data-template]")
        ?.getAttribute("data-template")
    ).toBe("modern")
  })

  it("keeps the chosen layout when a reload leaves the body unchanged", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/commands/paper.setTemplate")) {
        return Promise.resolve(
          ok({ ...record, templateId: "modern", contentVersion: 2 })
        )
      }
      return Promise.resolve(ok({}))
    })
    const open = render(
      <PaperCvEditor
        initial={record}
        pages={pages(1)}
        onBack={() => undefined}
      />
    )
    expect(
      open.container
        .querySelector("[data-paper-editor] [data-template]")
        ?.getAttribute("data-template")
    ).toBe("simple")
    fireEvent.click(screen.getByRole("button", { name: "Change template" }))
    fireEvent.click(screen.getByRole("button", { name: "Modern" }))
    fireEvent.click(screen.getByRole("button", { name: "Use template" }))
    await vi.waitFor(() => {
      expect(
        open.container
          .querySelector("[data-paper-editor] [data-template]")
          ?.getAttribute("data-template")
      ).toBe("modern")
    })
    open.unmount()

    const reloaded = render(
      <PaperCvEditor
        initial={{ ...record, templateId: "modern" }}
        pages={pages(1)}
        onBack={() => undefined}
      />
    )
    expect(
      reloaded.container
        .querySelector("[data-paper-editor] [data-template]")
        ?.getAttribute("data-template")
    ).toBe("modern")
  })

  it.each([1, 2])(
    "saves version %i text before a photo attaches and preserves it on the next edit",
    async (version) => {
      const fileId = "11111111-1111-4111-8111-111111111111"
      const calls: {
        url: string
        body?: { input?: Record<string, unknown> }
      }[] = []
      vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const body =
          typeof init?.body === "string"
            ? (JSON.parse(init.body) as { input?: Record<string, unknown> })
            : undefined
        calls.push({ url, body })
        if (url.includes("/api/paper/files") && init?.method === "POST") {
          return Promise.resolve(ok({ id: fileId }))
        }
        if (url.includes("/api/commands/paper.attachPhoto")) {
          return Promise.resolve(
            ok({
              ...record,
              templateId: "with-photo",
              contentVersion: 3,
              activityId: "33333333-3333-4333-8333-333333333333",
            })
          )
        }
        if (url.includes("/api/commands/paper.replace")) {
          return Promise.resolve(ok({ ...record, contentVersion: 2 }))
        }
        return Promise.resolve(ok({}))
      })

      const docId = "22222222-2222-4222-8222-222222222222"
      const view = render(
        <PaperCvEditor
          initial={{
            ...record,
            id: docId,
            templateId: "with-photo",
            document: version === 2 ? blankBlockDocument() : emptyCvDocument(),
          }}
          pages={{ docId, pages: 1, pageChoice: "unset" }}
          onBack={() => undefined}
        />
      )
      const summary =
        version === 2
          ? within(
              screen.getByRole("region", { name: "CV block canvas" })
            ).getByRole("textbox", { name: "Name" })
          : screen.getByRole("textbox", { name: "Summary" })
      function edit(text: string) {
        if (version === 2)
          fireEvent.change(summary, { target: { value: text } })
        else {
          summary.textContent = text
          fireEvent.input(summary)
        }
      }
      edit("Kept with the photo")
      const input = view.container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      expect(input).toBeTruthy()
      fireEvent.change(input, {
        target: {
          files: [
            new File([new Uint8Array(8)], "face.png", { type: "image/png" }),
          ],
        },
      })
      await vi.waitFor(() => {
        expect(
          calls.some((call) => call.url.includes("paper.attachPhoto"))
        ).toBe(true)
      })
      const replace = calls.find((call) => call.url.includes("paper.replace"))
      const attach = calls.find((call) =>
        call.url.includes("paper.attachPhoto")
      )
      expect(replace?.body?.input).toMatchObject({
        contentVersion: 1,
        document:
          version === 2
            ? { header: { name: "Kept with the photo" } }
            : { summary: "Kept with the photo" },
      })
      expect(calls.indexOf(replace!)).toBeLessThan(calls.indexOf(attach!))
      expect(attach?.body?.input).toMatchObject({ fileId })
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Change profile photo" })
        ).toBeInTheDocument()
      )
      expect(
        view.container.querySelector("img")?.getAttribute("src")
      ).toContain(`/api/paper/files/${fileId}/bytes`)
      edit("Edited after photo")
      await vi.waitFor(() => {
        const replacements = calls.filter((call) =>
          call.url.includes("paper.replace")
        )
        expect(replacements).toHaveLength(2)
        expect(replacements[1]?.body?.input).toMatchObject({
          contentVersion: 3,
          document:
            version === 2
              ? {
                  header: {
                    name: "Edited after photo",
                    photo: `file:${fileId}`,
                  },
                }
              : { summary: "Edited after photo", photoUrl: `file:${fileId}` },
        })
      })
    }
  )
})
