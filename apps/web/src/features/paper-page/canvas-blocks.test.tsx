import { afterEach, expect, it } from "vitest"
import { cleanup, render } from "@testing-library/react"

import { WritingBlocks } from "./canvas-blocks.tsx"
import { visibleText } from "./canvas-draw.ts"

afterEach(cleanup)

const CUE = "Write your letter, or ask Coach to draft it."

function paragraphs(texts: string[]) {
  const view = render(
    <article>
      <WritingBlocks
        blocks={texts.map((text, index) => ({ id: `b${index}`, text }))}
        placeholder={CUE}
      />
    </article>
  )
  return [...view.container.querySelectorAll("p")]
}

it("cues a blank letter on its one empty paragraph without adding words", () => {
  const [only] = paragraphs([""])
  expect(only).toHaveAttribute("data-placeholder", CUE)
  expect(only).not.toHaveTextContent(CUE)
  expect(only?.textContent).toBe(visibleText(""))
})

it("drops the cue once the letter has words or more than one paragraph", () => {
  expect(paragraphs(["Dear team"])[0]).not.toHaveAttribute("data-placeholder")
  for (const paragraph of paragraphs(["", ""]))
    expect(paragraph).not.toHaveAttribute("data-placeholder")
})
