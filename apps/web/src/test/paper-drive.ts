import { screen } from "@testing-library/react"
import { expect } from "vitest"

export async function expectPaperDrive() {
  expect(
    await screen.findByRole("region", { name: "Paper" })
  ).toBeInTheDocument()
  expect(
    await screen.findByRole("textbox", { name: "Search Paper" })
  ).toBeInTheDocument()
  expect(
    await screen.findByRole("button", { name: /^PM track CV,/ })
  ).toBeInTheDocument()
  expect(
    screen.getByRole("button", { name: /^Cover: Associate PM intern,/ })
  ).toBeInTheDocument()
}
