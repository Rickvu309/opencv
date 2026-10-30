import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { renderApp } from "@/test/render-app.tsx"

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
      const search = await screen.findByRole("textbox", {
        name: "Search Paper",
      })
      fireEvent.change(search, { target: { value: query } })
      await waitFor(() => expect(search).toHaveValue(query))
      fireEvent.click(
        await screen.findByRole("button", { name: new RegExp(`${name},`) })
      )
      await screen.findByRole("region", { name: new RegExp(`Editing ${name}`) })
      router.history.back()
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: "Search Paper" })
        ).toHaveValue(query)
      )
    }
  )

  it.each(records)(
    "restores the query after the Paper button from $kind",
    async ({ name, query }) => {
      renderApp("/paper")
      const search = await screen.findByRole("textbox", {
        name: "Search Paper",
      })
      fireEvent.change(search, { target: { value: query } })
      await waitFor(() => expect(search).toHaveValue(query))
      fireEvent.click(
        await screen.findByRole("button", { name: new RegExp(`${name},`) })
      )
      await screen.findByRole("region", { name: new RegExp(`Editing ${name}`) })
      fireEvent.click(
        screen.getByRole("button", { name: "Paper", exact: true })
      )
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: "Search Paper" })
        ).toHaveValue(query)
      )
    }
  )
})
