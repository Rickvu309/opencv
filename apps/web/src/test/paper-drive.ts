import { screen, within } from "@testing-library/react"
import { expect } from "vitest"

export async function expectPaperDrive() {
  expect(
    await screen.findByRole("region", { name: "Paper" })
  ).toBeInTheDocument()
  expect(
    screen.getByRole("textbox", { name: "Search Paper" })
  ).toBeInTheDocument()
  const table = await screen.findByRole("table")
  expect(within(table).getByText("PM track CV")).toBeInTheDocument()
  expect(
    within(table).getByText("Cover: Associate PM intern")
  ).toBeInTheDocument()
  expect(
    within(table).getByText("Checkout card resize study")
  ).toBeInTheDocument()
}
