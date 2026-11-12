import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import {
  LANDING_FIGURE_LABELS,
  LANDING_PRODUCTS,
  type LandingFigureId,
} from "../landing-copy.ts"
import { LandingFigure } from "./landing-figure.tsx"

afterEach(cleanup)

const IDS = Object.keys(LANDING_FIGURE_LABELS) as LandingFigureId[]

describe("landing figure", () => {
  it.each(IDS)("%s is one named image whose drawing is hidden", (id) => {
    const { container } = render(<LandingFigure id={id} />)

    const figure = screen.getByRole("img", { name: LANDING_FIGURE_LABELS[id] })
    const stage = figure.firstElementChild
    expect(stage).toHaveAttribute("aria-hidden", "true")
    expect(stage?.children.length).toBeGreaterThan(0)
    expect(container.querySelector("style")).toBeNull()
  })

  it("gives every figure the landing copy asks for a label", () => {
    const used = LANDING_PRODUCTS.map((entry) => entry.figure)
    for (const id of used) expect(LANDING_FIGURE_LABELS[id]).toBeTruthy()
  })
})
