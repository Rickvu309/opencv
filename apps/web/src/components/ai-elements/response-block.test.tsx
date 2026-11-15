import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"

import { Response } from "@/components/ai-elements/response.tsx"

afterEach(() => {
  cleanup()
})

describe("Response renders Coach Markdown", () => {
  it("draws headings, safe links and a scrollable comparison table", () => {
    const { container } = render(
      <Response
        text={[
          "# Learn C#",
          "## Next steps",
          "Read [the role](https://jobs.example.com/a) or https://example.com/b.",
          "",
          "| Role | Fit |",
          "| --- | --- |",
          "| Analyst | High |",
        ].join("\n")}
      />
    )
    expect(
      screen.getByRole("heading", { name: "Learn C#", level: 3 })
    ).toBeVisible()
    expect(screen.getByRole("heading", { name: "Next steps" })).toBeVisible()
    const role = screen.getByRole("link", { name: "the role" })
    expect(role).toHaveAttribute("href", "https://jobs.example.com/a")
    expect(role).toHaveAttribute("rel", "noopener noreferrer")
    expect(
      screen.getByRole("link", { name: "https://example.com/b" })
    ).toHaveAttribute("href", "https://example.com/b")
    const region = screen.getByRole("region", { name: "Table" })
    expect(region).toHaveClass("overflow-x-auto", "max-w-full")
    expect(region).toHaveAttribute("tabindex", "0")
    expect(
      within(region).getByRole("columnheader", { name: "Fit" })
    ).toBeVisible()
    expect(within(region).getByRole("cell", { name: "Analyst" })).toBeVisible()
    expect(container.textContent).not.toMatch(/##|\]\(|\| ---/)
  })

  it("renders no anchor for an unsafe scheme and keeps raw tags as text", () => {
    const { container } = render(
      <Response
        text={"[click](javascript:alert(1)) <img src=x onerror=alert(1)>"}
      />
    )
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(container.querySelector("img, script")).toBeNull()
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>")
  })

  it("never draws a link inside a link", () => {
    const { container } = render(
      <Response text="[Read https://example.com](https://other.com)" />
    )
    expect(container.querySelectorAll("a")).toHaveLength(1)
    expect(container.querySelector("a a")).toBeNull()
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://other.com/"
    )
  })
})
