import type { JobView, PaperView } from "@workspace/domain"
import { StrictMode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { render } from "@/test/render-with-client.tsx"

import { PaperLetterEditor, PaperLetterStart } from "./paper-letter.tsx"

const job: JobView = {
  id: "job-1",
  title: "Associate PM",
  company: "Northwind",
  posting: { requirements: "The role needs Meta Ads" },
  cvDocId: null,
  letterDocId: null,
  updatedAt: "2026-08-25T12:00:00.000Z",
}

const letter: PaperView = {
  id: "letter-1",
  name: "Cover letter, Northwind",
  kind: "letter",
  templateId: "simple",
  status: "draft",
  document: { markdown: "I write clearly." },
  contentVersion: 1,
  checks: [],
  pageChoice: "unset",
  isFavorite: false,
  sourceFileId: null,
  createdAt: "2026-08-25T12:00:00.000Z",
  updatedAt: "2026-08-25T12:00:00.000Z",
}

type Call = { url: string; body: unknown }

function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

function fail(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status })
}

function installFetch(mode: "tool" | "stop" | "limit") {
  const calls: Call[] = []
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null
    calls.push({ url, body })
    if (url.includes("/api/paper/letter-attachment"))
      return Promise.resolve(
        ok({
          name: "role-description.txt",
          text: "Lead customer research and delivery.",
          truncated: false,
        })
      )
    if (url.includes("/api/commands/paper.create"))
      return Promise.resolve(ok(letter))
    if (url.includes("/api/commands/chat.create")) {
      return Promise.resolve(ok({ id: "chat-1" }))
    }
    if (url.includes("/api/paper/letter-1")) return Promise.resolve(ok(letter))
    if (url.includes("/stop")) return Promise.resolve(ok({}))
    if (url.includes("/api/coach/usage")) {
      return Promise.resolve(ok({ resetsAt: "2026-10-28T09:00:00.000Z" }))
    }
    if (url.includes("/turns")) {
      if (mode === "limit") {
        return Promise.resolve(
          fail(429, "RATE_LIMITED", "Try again in the morning.")
        )
      }
      if (mode === "stop") {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
          })
        })
      }
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              [
                'event: text-delta\ndata: {"text":"Dear team"}\n\n',
                'event: tool-call\ndata: {"toolCallId":"c1","name":"paper.replace","input":{"docId":"letter-1","contentVersion":1,"document":{"markdown":"Dear team"}}}\n\n',
                'event: tool-result\ndata: {"toolCallId":"c1","name":"paper.replace","summary":"Updated","ok":true,"result":{"ok":true,"data":{}}}\n\n',
              ].join("")
            )
          )
          controller.close()
        },
      })
      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
      )
    }
    return Promise.resolve(ok({}))
  })
  return calls
}

function start() {
  render(
    <PaperLetterStart
      jobs={[job]}

      onCreated={() => undefined}
    />
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Associate PM, Northwind" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
}

afterEach(() => {
  document.body.removeAttribute("data-print")
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("Cover letter", () => {
  it.each([
    "https://lnkd.in/role",
    "https://linkedin.com:443/jobs/role",
    "https://jobs.uk.linkedin.com/role",
    "<https://linkedin.com/jobs/role>",
    "https://linkedin.com/jobs/role https://docs.google.com/document/d/role",
  ])("blocks unsupported link-only context: %s", (query) => {
    installFetch("tool")
    render(<PaperLetterStart jobs={[job]} onCreated={() => undefined} />)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: query } })
    expect(screen.getByRole("button", { name: "Draft letter" })).toBeDisabled()
    expect(screen.getByRole("status")).toHaveTextContent("Can't read this link")
  })

  it("blocks a bare unreadable link and recovers when job text replaces it", () => {
    const calls = installFetch("tool")
    render(<PaperLetterStart jobs={[job]} onCreated={() => undefined} />)
    fireEvent.click(
      screen.getByRole("button", { name: "Associate PM, Northwind" })
    )
    const input = screen.getByRole("textbox")
    fireEvent.change(input, {
      target: { value: "https://www.linkedin.com/jobs/view/3829174610" },
    })
    const draft = screen.getByRole("button", { name: "Draft letter" })
    expect(draft).toBeDisabled()
    expect(draft).toHaveAccessibleDescription(
      "Can't read this link Paste the job text or attach a file."
    )
    expect(
      screen.queryByRole("button", { name: "Associate PM, Northwind" })
    ).not.toBeInTheDocument()
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.click(draft)
    expect(calls).toEqual([])
    fireEvent.change(input, {
      target: {
        value: "Lead research. Apply at linkedin.com/jobs/view/3829174610",
      },
    })
    expect(draft).toBeEnabled()
    expect(screen.queryByText("Can't read this link")).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: "" } })
    expect(draft).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Associate PM, Northwind" })
    ).toBeVisible()
  })

  it("recovers an unreadable link with extracted context and blocks again on removal", async () => {
    installFetch("tool")
    render(<PaperLetterStart jobs={[job]} onCreated={() => undefined} />)
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "docs.google.com/document/d/role" },
    })
    const draft = screen.getByRole("button", { name: "Draft letter" })
    expect(draft).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Attach letter context"), {
      target: {
        files: [
          new File(["Lead customer research"], "role.txt", {
            type: "text/plain",
          }),
        ],
      },
    })
    await screen.findByText("Context: role-description.txt")
    expect(draft).toBeEnabled()
    expect(screen.queryByText("Can't read this link")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Remove attachment" }))
    expect(draft).toBeDisabled()
  })

  it("explains the required context and enables drafting for job text or a selected job", () => {
    const calls = installFetch("tool")
    render(<PaperLetterStart jobs={[job]} onCreated={() => undefined} />)
    const draft = screen.getByRole("button", { name: "Draft letter" })
    const input = screen.getByRole("textbox")
    expect(draft).toBeDisabled()
    expect(draft).toHaveAccessibleDescription(
      "Choose a job, paste job text or a link, or attach a file to draft a letter."
    )
    fireEvent.click(draft)
    expect(calls).toEqual([])
    fireEvent.change(input, { target: { value: "  \n " } })
    expect(draft).toBeDisabled()
    fireEvent.change(input, { target: { value: "We need a product manager." } })
    expect(draft).toBeEnabled()
    fireEvent.change(input, { target: { value: "https://example.com/job" } })
    expect(draft).toBeEnabled()
    fireEvent.change(input, { target: { value: "" } })
    expect(draft).toBeDisabled()
    fireEvent.click(
      screen.getByRole("button", { name: "Associate PM, Northwind" })
    )
    expect(draft).toBeEnabled()
  })

  it("drafts on Enter only with context and after composition ends", async () => {
    const calls = installFetch("tool")
    render(<PaperLetterStart jobs={[job]} onCreated={() => undefined} />)
    const input = screen.getByRole("textbox")
    fireEvent.keyDown(input, { key: "Enter" })
    expect(calls).toEqual([])
    fireEvent.change(input, { target: { value: "A product role" } })
    fireEvent.keyDown(input, { key: "Enter", isComposing: true })
    expect(calls).toEqual([])
    fireEvent.keyDown(input, { key: "Enter" })
    await vi.waitFor(() =>
      expect(calls.some((call) => call.url.includes("/turns"))).toBe(true)
    )
    expect(
      calls.filter((call) => call.url.includes("/commands/paper.create"))
    ).toHaveLength(1)
  })

  it("drafts the new search instead of a selected job hidden by that search", async () => {
    const calls = installFetch("tool")
    render(<PaperLetterStart jobs={[job]} onCreated={() => undefined} />)
    fireEvent.click(
      screen.getByRole("button", { name: "Associate PM, Northwind" })
    )
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "A different engineering role" },
    })
    expect(
      screen.queryByRole("button", { pressed: true })
    ).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" })
    await vi.waitFor(() =>
      expect(calls.some((call) => call.url.includes("/turns"))).toBe(true)
    )
    expect(calls.find((call) => call.url.includes("/turns"))?.body).toEqual(
      expect.objectContaining({
        text: expect.stringContaining("A different engineering role"),
      })
    )
    expect(
      calls.find((call) => call.url.includes("/paper.create"))?.body
    ).toEqual(
      expect.objectContaining({
        input: expect.not.objectContaining({ jobId: job.id }),
      })
    )
  })

  it("keeps an upload as Letter context and sends its text without creating a CV", async () => {
    const calls = installFetch("tool")
    const onCreated = vi.fn()
    render(<PaperLetterStart jobs={[]} onCreated={onCreated} />)
    const file = new File(
      ["Lead customer research and delivery."],
      "role-description.txt",
      {
        type: "text/plain",
      }
    )
    fireEvent.change(screen.getByLabelText("Attach letter context"), {
      target: { files: [file] },
    })
    await screen.findByText("Context: role-description.txt")
    expect(onCreated).not.toHaveBeenCalled()
    expect(calls.filter((call) => call.url.includes("/commands/"))).toEqual([])
    expect(screen.queryByText(/From CV/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
    await vi.waitFor(() =>
      expect(calls.some((call) => call.url.includes("/turns"))).toBe(true)
    )
    expect(calls.find((call) => call.url.includes("/turns"))?.body).toEqual(
      expect.objectContaining({
        text: expect.stringContaining("Lead customer research and delivery."),
      })
    )
    expect(
      calls.find((call) => call.url.includes("/paper.create"))?.body
    ).toEqual(
      expect.objectContaining({
        input: expect.objectContaining({ kind: "letter" }),
      })
    )
    expect(calls.some((call) => call.url.includes("/paper/import"))).toBe(false)
  })

  it("removes attached context and requires a job or job text again", async () => {
    installFetch("tool")
    render(<PaperLetterStart jobs={[]} onCreated={() => undefined} />)
    fireEvent.change(screen.getByLabelText("Attach letter context"), {
      target: { files: [new File(["Job"], "role-description.txt")] },
    })
    await screen.findByText("Context: role-description.txt")
    expect(screen.getByRole("button", { name: "Draft letter" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "Remove attachment" }))
    expect(
      screen.queryByText("Context: role-description.txt")
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Draft letter" })).toBeDisabled()
  })

  it("preserves typed job context when an attachment cannot be read", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(fail(400, "FILE_UNSUPPORTED", "No readable text found."))
    )
    render(<PaperLetterStart jobs={[job]} onCreated={() => undefined} />)
    const query = screen.getByRole("textbox")
    fireEvent.change(query, { target: { value: "Product manager in retail" } })
    fireEvent.change(screen.getByLabelText("Attach letter context"), {
      target: { files: [new File([""], "blank.txt")] },
    })
    await screen.findByText("No readable text found.")
    expect(query).toHaveValue("Product manager in retail")
    expect(screen.getByRole("button", { name: "Draft letter" })).toBeEnabled()
    expect(screen.queryByText(/Context:/)).not.toBeInTheDocument()
  })

  it("does not claim a CV source in the saved letter editor", () => {
    installFetch("tool")
    render(
      <PaperLetterEditor doc={letter} job={job} onBack={() => undefined} />
    )
    expect(screen.queryByText(/^From/)).not.toBeInTheDocument()
    expect(screen.getByText("I write clearly.")).toBeInTheDocument()
  })

  it("prints the letter from Download PDF", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(ok({})))
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      expect(document.body).toHaveAttribute("data-print", "paper")
      const sheet = document.querySelector("[data-paper-letter]")
      expect(sheet?.textContent).toContain("I write clearly.")
      window.dispatchEvent(new Event("afterprint"))
    })
    render(
      <PaperLetterEditor
        doc={letter}
        job={job}

        onBack={() => undefined}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "More" }))
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Download PDF" })
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(print).toHaveBeenCalledTimes(1)
  })

  it("keeps Download PDF in the More menu and not in the header", () => {
    vi.stubGlobal("fetch", () => Promise.resolve(ok({})))
    render(
      <PaperLetterEditor doc={letter} job={job} onBack={() => undefined} />
    )
    expect(
      screen.queryByRole("button", { name: "Download PDF" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument()
  })

  it("copies the share link from the link button and says so", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      calls.push(String(input))
      return Promise.resolve(ok({ token: "tok-123" }))
    })
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })
    render(
      <PaperLetterEditor doc={letter} job={job} onBack={() => undefined} />
    )
    fireEvent.click(screen.getByRole("button", { name: "Copy share link" }))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(calls.some((url) => url.includes("paper.share"))).toBe(true)
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(String((writeText.mock.calls[0] as unknown[])[0])).toContain(
      "tok-123"
    )
  })

  it("prints once in strict mode and unmounts the letter sheet", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(ok({})))
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined)
    render(
      <StrictMode>
        <PaperLetterEditor
          doc={letter}
          job={job}

          onBack={() => undefined}
        />
      </StrictMode>
    )
    fireEvent.click(screen.getByRole("button", { name: "More" }))
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Download PDF" })
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(print).toHaveBeenCalledTimes(1)
    expect(document.querySelector("[data-paper-letter]")).not.toBeNull()
    act(() => {
      window.dispatchEvent(new Event("afterprint"))
    })
    expect(document.querySelector("[data-paper-letter]")).toBeNull()
  })

  it("drafts with the job title and refetches on a paper replace tool result", async () => {
    const calls = installFetch("tool")
    start()
    await vi.waitFor(() => {
      expect(
        calls.some((call) => call.url.includes("/api/paper/letter-1"))
      ).toBe(true)
    })
    expect(calls.find((call) => call.url.includes("/turns"))?.body).toEqual(
      expect.objectContaining({
        text: "Draft a cover letter for Associate PM at Northwind.",
        focusDocId: "letter-1",
      })
    )
    expect(
      calls.some((call) => call.url.includes("/api/commands/paper.replace"))
    ).toBe(false)
  })

  it("stops the stream", async () => {
    const calls = installFetch("stop")
    start()
    fireEvent.click(await screen.findByRole("button", { name: "Stop" }))
    await vi.waitFor(() => {
      expect(
        calls.some((call) => call.url.includes("/api/chats/chat-1/stop"))
      ).toBe(true)
    })
  })

  it("shows the Free limit after a 429", async () => {
    installFetch("limit")
    start()
    expect(
      await screen.findByText("You've reached today's Free limit.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /^Coach is back at / })
    ).toBeDisabled()
  })

  it("offers Add to letter for a Meta Ads gap and Skip closes the card", () => {
    render(
      <PaperLetterEditor
        doc={letter}
        job={job}

        onBack={() => undefined}
      />
    )
    expect(screen.getByText(/The job asks for Meta/)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Add to letter" })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    expect(
      screen.queryByRole("button", { name: "Add to letter" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Skip" })
    ).not.toBeInTheDocument()
  })
})
