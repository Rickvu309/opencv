import { screen } from "@testing-library/react"
import { expect } from "vitest"

export async function expectPaperDrive() {
  expect(
    await screen.findByRole("region", { name: "Paper" })
  ).toBeInTheDocument()
  expect(
    screen.getByRole("textbox", { name: "Search documents" })
  ).toBeInTheDocument()
  expect(await screen.findByText("PM track CV")).toBeInTheDocument()
  expect(screen.getByText("Cover: Associate PM intern")).toBeInTheDocument()
  expect(screen.getByText("Checkout card resize study")).toBeInTheDocument()
}
