import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { renderApp } from "@/test/render-app.tsx"

const OLDER_FORMAT = "This document cannot be opened in Paper."

const records = [
  { kind: "cv", name: "PM track CV", query: "PM track" },
  { kind: "letter", name: "Cover: Associate PM intern", query: "Associate" },
] as const

afterEach(cleanup)

describe("Paper search route state", () => {
  it.each(records)(
    "restores the query after browser Back from $kind",
    async ({ name, query }) => {
      const { router } = renderApp("/paper")
      const search = await screen.findByRole("searchbox", {
        name: "Search Paper",
      })
      fireEvent.change(search, { target: { value: query } })
      await waitFor(() => expect(search).toHaveValue(query))
      const otherName =
        name === "PM track CV" ? "Cover: Associate PM intern" : "PM track CV"
      expect(
        screen.queryByRole("button", { name: new RegExp(`${otherName},`) })
      ).not.toBeInTheDocument()
      fireEvent.click(
        await screen.findByRole("button", { name: new RegExp(`${name},`) })
      )
      await screen.findByText(OLDER_FORMAT)
      router.history.back()
      await waitFor(() =>
        expect(
          screen.getByRole("searchbox", { name: "Search Paper" })
        ).toHaveValue(query)
      )
      expect(
        screen.queryByRole("button", { name: new RegExp(`${otherName},`) })
      ).not.toBeInTheDocument()
    }
  )

  it.each(records)(
    "restores the query after the Paper button from $kind",
    async ({ name, query }) => {
      renderApp("/paper")
      const search = await screen.findByRole("searchbox", {
        name: "Search Paper",
      })
      fireEvent.change(search, { target: { value: query } })
      await waitFor(() => expect(search).toHaveValue(query))
      const otherName =
        name === "PM track CV" ? "Cover: Associate PM intern" : "PM track CV"
      expect(
        screen.queryByRole("button", { name: new RegExp(`${otherName},`) })
      ).not.toBeInTheDocument()
      fireEvent.click(
        await screen.findByRole("button", { name: new RegExp(`${name},`) })
      )
      const message = (await screen.findByText(OLDER_FORMAT)).closest(
        "section"
      )!
      fireEvent.click(within(message).getByRole("button", { name: "Paper" }))
      await waitFor(() =>
        expect(
          screen.getByRole("searchbox", { name: "Search Paper" })
        ).toHaveValue(query)
      )
      expect(
        screen.queryByRole("button", { name: new RegExp(`${otherName},`) })
      ).not.toBeInTheDocument()
    }
  )

  it("keeps URL search strings verbatim and removes q when cleared", async () => {
    const { router } = renderApp("/paper?q=Untitled")
    const search = await screen.findByRole("searchbox", {
      name: "Search Paper",
    })
    expect(search).toHaveValue("Untitled")
    const special = ' 123 {"n":1} '
    fireEvent.change(search, { target: { value: special } })
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ q: special })
    )
    expect(search).toHaveValue(special)
    fireEvent.change(search, { target: { value: "" } })
    await waitFor(() => expect(router.state.location.search).toEqual({}))
    expect(search).toHaveValue("")
  })
})
