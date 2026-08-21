import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { HomePage } from "./home.tsx"

describe("HomePage", () => {
  it("renders the OpenPath heading", () => {
    render(createElement(HomePage))
    expect(
      screen.getByRole("heading", { level: 1, name: "OpenPath" })
    ).toBeInTheDocument()
  })
})
