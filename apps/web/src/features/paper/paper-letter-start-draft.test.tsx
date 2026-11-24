import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"

import {
  setMockSession,
  TEST_SESSION,
  TEST_SESSION_USER,
} from "@/test/auth-client-mock.ts"
import { render } from "@/test/render-with-client.tsx"
import {
  fail,
  installFetch,
  job,
  startDrafting,
} from "@/test/paper-letter-kit.tsx"

import { PaperLetterStart } from "./paper-letter.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("Cover letter drafting", () => {
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
      expect(calls.some((call) => call.url.includes("/paper.canvas"))).toBe(
        true
      )
    )
    expect(calls.find((call) => call.url.includes("/turns"))?.body).toEqual(
      expect.objectContaining({
        text: expect.stringContaining("A different engineering role"),
        textOnly: true,
      })
    )
    expect(
      calls.find((call) => call.url.includes("/paper.canvas"))?.body
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
      expect(calls.some((call) => call.url.includes("/paper.canvas"))).toBe(
        true
      )
    )
    expect(calls.find((call) => call.url.includes("/turns"))?.body).toEqual(
      expect.objectContaining({
        text: expect.stringContaining("Lead customer research and delivery."),
      })
    )
    expect(
      calls.find((call) => call.url.includes("/paper.canvas"))?.body
    ).toEqual(
      expect.objectContaining({
        input: expect.objectContaining({ op: "mint", label: "letter" }),
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

  it("drafts with the job title, then opens a Word page linked to the Job with the draft in it", async () => {
    const calls = installFetch("tool")
    startDrafting()
    await vi.waitFor(() => {
      expect(
        calls.some((call) => call.url.includes("/api/commands/paper.canvas"))
      ).toBe(true)
    })
    const turn = calls.find((call) => call.url.includes("/turns"))?.body
    expect(turn).toEqual(
      expect.objectContaining({
        text: expect.stringContaining(
          "Draft a cover letter for Associate PM at Northwind."
        ),
      })
    )
    expect(turn).not.toHaveProperty("focusDocId")
    expect(
      calls.find((call) => call.url.includes("/api/commands/paper.canvas"))
        ?.body
    ).toEqual(
      expect.objectContaining({
        input: {
          op: "mint",
          label: "letter",
          name: "Cover letter, Northwind",
          jobId: job.id,
          lines: ["Dear team", "I write clearly."],
        },
      })
    )
    expect(
      calls.filter(
        (call) =>
          call.url.includes("/api/commands/paper.") &&
          !call.url.includes("/paper.canvas")
      )
    ).toEqual([])
  })

  it("fills the signed-in person's own email into the letter page in place of the placeholder", async () => {
    const calls = installFetch("tool")
    const answer = globalThis.fetch
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const res = await answer(input, init)
        if (!String(input).includes("/turns")) return res
        const stream = (await res.text()).replace(
          "I write clearly.",
          "Reach me at [Your email]."
        )
        return new Response(stream, {
          status: res.status,
          headers: res.headers,
        })
      }
    )
    const other = { ...TEST_SESSION_USER, email: "someone.else@example.com" }
    setMockSession({ user: other, session: TEST_SESSION })
    startDrafting()
    await vi.waitFor(() => {
      expect(
        calls.some((call) => call.url.includes("/api/commands/paper.canvas"))
      ).toBe(true)
    })
    const minted = calls.find((call) =>
      call.url.includes("/api/commands/paper.canvas")
    )?.body as { input: { lines: string[] } }
    expect(minted.input.lines).toEqual([
      "Dear team",
      "Reach me at someone.else@example.com.",
    ])
    expect(JSON.stringify(minted)).not.toContain(TEST_SESSION_USER.email)
    expect(
      JSON.stringify(calls.find((call) => call.url.includes("/turns"))?.body)
    ).not.toContain("@")
  })

  it("stops the stream", async () => {
    const calls = installFetch("stop")
    startDrafting()
    fireEvent.click(await screen.findByRole("button", { name: "Stop" }))
    await vi.waitFor(() => {
      expect(
        calls.some((call) => call.url.includes("/api/commands/coach.stop"))
      ).toBe(true)
    })
  })

  it("shows the Free limit after a 429", async () => {
    installFetch("limit")
    startDrafting()
    expect(
      await screen.findByText("You've reached today's Free limit.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /^Coach is back at / })
    ).toBeDisabled()
  })
})
