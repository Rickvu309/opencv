import { screen } from "@testing-library/react"
import { expect } from "vitest"

export async function expectPaperDrive() {
  expect(
    await screen.findByRole("region", { name: "Paper" })
  ).toBeInTheDocument()
  expect(
    await screen.findByRole("searchbox", { name: "Search Paper" })
  ).toBeInTheDocument()
  expect(
    await screen.findByRole("button", { name: /^Open PM track CV,/ })
  ).toBeInTheDocument()
  expect(
    screen.getByRole("button", { name: /^Open Cover: Associate PM intern,/ })
  ).toBeInTheDocument()
}
