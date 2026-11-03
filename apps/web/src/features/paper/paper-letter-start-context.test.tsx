import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"

import { render } from "@/test/render-with-client.tsx"
import { installFetch, job } from "@/test/paper-letter-kit.tsx"

import { PaperLetterStart } from "./paper-letter.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("Cover letter context", () => {
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
})
