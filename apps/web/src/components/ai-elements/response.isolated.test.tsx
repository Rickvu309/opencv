import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"

const { rendered } = vi.hoisted(() => ({ rendered: [] as string[] }))

vi.mock("./response-block.tsx", () => ({
  ResponseBlock: ({ source }: { source: string }) => {
    rendered.push(source)
    return createElement("div", { "data-block": source }, source)
  },
}))

import { Response } from "./response.tsx"

afterEach(() => {
  cleanup()
  rendered.length = 0
})

describe("Response", () => {
  it("leaves a finished paragraph in place while the next paragraph grows", () => {
    const first = "Tighten the summary."
    const view = render(
      createElement(Response, { text: `${first}\n\nStarted` })
    )
    const firstRenders = rendered.filter((source) => source.includes(first))
    expect(firstRenders).toHaveLength(1)

    view.rerender(
      createElement(Response, { text: `${first}\n\nStarted and still writing` })
    )

    expect(rendered.filter((source) => source.includes(first))).toHaveLength(1)
    expect(
      rendered.filter((source) => source.includes("still writing"))
    ).toHaveLength(1)
  })

  it("keeps the growing paragraph on the page instead of rebuilding it", () => {
    const view = render(createElement(Response, { text: "Lead with" }))
    const growing = view.container.querySelector("[data-block]")

    view.rerender(createElement(Response, { text: "Lead with the outcome" }))

    expect(view.container.querySelector("[data-block]")).toBe(growing)
    expect(growing?.textContent).toContain("the outcome")
  })
})
