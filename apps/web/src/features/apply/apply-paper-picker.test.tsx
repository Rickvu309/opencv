import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { renderApp } from "@/test/render-app.tsx"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import { setMockJobs } from "@/test/apply-jobs-mock.ts"
import {
  failPaperList,
  getMockPaperDocs,
  holdPaperList,
} from "@/test/paper-api-mock.ts"

const id = "01900000-0000-7000-8000-000000000041"
const cases = [
  {
    kind: "cv",
    title: "CV",
    trigger: "Add CV",
    noun: "CVs",
    name: "PM track CV",
  },
  {
    kind: "letter",
    title: "Cover letter",
    trigger: "Add cover letter",
    noun: "cover letters",
    name: "Cover: Associate PM intern",
  },
] as const

async function openPicker(trigger: string) {
  setMockJobs([mockJob({ id, title: "Picker job" })])
  renderApp(`/apply/${id}`)
  fireEvent.click(await screen.findByRole("button", { name: trigger }))
}

describe("job Paper picker feedback", () => {
  afterEach(cleanup)

  it.each(cases)(
    "names the $kind picker by kind before and after linking",
    async ({ kind, trigger, title, name }) => {
      await openPicker(trigger)
      expect(
        await screen.findByRole("dialog", { name: title })
      ).toBeInTheDocument()
      cleanup()
      const doc = getMockPaperDocs().find((doc) => doc.name === name)!
      setMockJobs([
        mockJob({
          id,
          title: "Picker job",
          linked: {
            cv: kind === "cv" ? doc : null,
            letter: kind === "letter" ? doc : null,
          },
        }),
      ])
      renderApp(`/apply/${id}`)
      fireEvent.click(
        await screen.findByRole("button", { name: `${title}: ${name}` })
      )
      expect(
        await screen.findByRole("dialog", { name: title })
      ).toBeInTheDocument()
    }
  )

  it.each(cases)(
    "explains unmatched $kind searches and restores rows when cleared",
    async ({ trigger, noun, name }) => {
      await openPicker(trigger)
      await screen.findByRole("button", { name: new RegExp(name) })
      const search = screen.getByRole("textbox", { name: "Find in Paper" })
      fireEvent.change(search, { target: { value: "no-such-paper-685" } })
      expect(screen.getByRole("status")).toHaveTextContent(
        `No ${noun} match your search.`
      )
      expect(
        screen.queryByRole("button", { name: new RegExp(name) })
      ).toBeNull()
      fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
      expect(search).toHaveValue("")
      expect(
        await screen.findByRole("button", { name: new RegExp(name) })
      ).toBeInTheDocument()
      expect(screen.queryByText(`No ${noun} match your search.`)).toBeNull()
      fireEvent.change(search, { target: { value: "   " } })
      expect(
        screen.getByRole("button", { name: new RegExp(name) })
      ).toBeInTheDocument()
    }
  )

  it.each(cases)(
    "explains an empty $kind library",
    async ({ kind, trigger, noun }) => {
      const docs = getMockPaperDocs()
      docs.splice(0, docs.length, ...docs.filter((doc) => doc.kind !== kind))
      await openPicker(trigger)
      expect(
        await screen.findByText(`No ${noun} in Paper yet.`)
      ).toHaveAttribute("role", "status")
      expect(
        screen.getByRole("link", {
          name:
            kind === "cv" ? "Create a CV in Paper" : "Write a new cover letter",
        })
      ).toHaveAttribute("href", "/paper")
    }
  )

  it("shows loading until the list resolves", async () => {
    const release = holdPaperList()
    try {
      await openPicker("Add CV")
      expect(screen.getByRole("status")).toHaveTextContent("Loading Paper")
      expect(screen.queryByText(/No CVs/)).toBeNull()
    } finally {
      release()
    }
    expect(
      await screen.findByRole("button", { name: /PM track CV/ })
    ).toBeInTheDocument()
  })

  it("explains a failed request and retries without reopening", async () => {
    failPaperList()
    await openPicker("Add CV")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load Paper. Try again."
    )
    expect(screen.queryByText(/No CVs/)).toBeNull()
    failPaperList(false)
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(
      await screen.findByRole("button", { name: /PM track CV/ })
    ).toBeInTheDocument()
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
