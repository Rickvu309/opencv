import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Switch } from "./switch"

afterEach(cleanup)

const SPACING_PX = 4
const PHONE_TARGET_PX = 44

function spacing(tokens: string[], prefix: string) {
  const token = tokens.find((candidate) => candidate.startsWith(prefix))
  if (!token) throw new Error(`no ${prefix} class on the switch`)
  return Number(token.slice(prefix.length)) * SPACING_PX
}

function tapBox(size: "default" | "sm") {
  render(<Switch size={size} aria-label="Enable memory" />)
  const tokens = screen
    .getByRole("switch", { name: "Enable memory" })
    .className.split(/\s+/)
  const sized = `data-[size=${size}]:`
  const outset = tokens.some((token) =>
    token.startsWith(`${sized}after:-inset-`)
  )
    ? spacing(tokens, `${sized}after:-inset-`)
    : spacing(tokens, "after:-inset-")
  return {
    height: spacing(tokens, `${sized}h-`) + 2 * outset,
    width: spacing(tokens, `${sized}w-`) + 2 * outset,
  }
}

describe("switch", () => {
  it.each(["default", "sm"] as const)(
    "a %s switch takes taps across at least 44px each way",
    (size) => {
      const box = tapBox(size)
      expect(box.height).toBeGreaterThanOrEqual(PHONE_TARGET_PX)
      expect(box.width).toBeGreaterThanOrEqual(PHONE_TARGET_PX)
    }
  )
})
