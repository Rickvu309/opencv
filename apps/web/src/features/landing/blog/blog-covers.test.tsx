import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"

import { BlogCoverArt } from "./blog-covers.tsx"
import type { BlogCoverKey } from "./blog-copy.ts"

afterEach(cleanup)

it.each<[BlogCoverKey, string[]]>([
  ["show-work", ["DUTY", "RESULT", "200", "1,400", "Event post views"]],
  [
    "fewer-applications",
    ["50 generic", "5 specific", "One job. One tailored CV."],
  ],
  [
    "top-third",
    ["Summary", "First role", "Three bullets", "Tailor this", "Keep the rest"],
  ],
  [
    "follow-up",
    [
      "Applied",
      "3 days later",
      "Follow-up",
      "What I’d fix first",
      "Link to proof",
    ],
  ],
  [
    "discovery",
    ["Ask first", "What needs fixing?", "Then show", "One relevant case"],
  ],
  [
    "in-public",
    ["Open to work", "Publish the work", "Before", "After", "View the case"],
  ],
])(
  "%s draws the article's argument in visible SVG content",
  (cover, labels) => {
    render(<BlogCoverArt cover={cover} />)
    const image = screen.getByRole("img")
    for (const label of labels) {
      expect(
        [...image.querySelectorAll("text")].some(
          (text) => text.textContent === label
        )
      ).toBe(true)
    }
  }
)
