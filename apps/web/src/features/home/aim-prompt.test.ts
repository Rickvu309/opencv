import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  AIM_OPTIONS,
  headlineForAim,
  parseAimPromptState,
  readAimPromptState,
  resolveAimPrompt,
  writeAimPromptState,
} from "./aim-prompt.ts"

describe("optional aim prompt", () => {
  it("offers a café/part-time path plus internship/FT aims and no wizard steps", () => {
    expect(AIM_OPTIONS).toHaveLength(4)
    expect(AIM_OPTIONS.map((option) => option.id)).toEqual([
      "cafe-part-time",
      "summer-intern",
      "product-intern",
      "first-job",
    ])
    expect(AIM_OPTIONS[0]).toMatchObject({
      id: "cafe-part-time",
      label: "A café or part-time job",
      headline: "Working café shifts while I study",
    })
    expect(
      AIM_OPTIONS.some((option) =>
        /café|cafe|part-time|studying/i.test(
          `${option.label} ${option.headline}`
        )
      )
    ).toBe(true)
    expect(AIM_OPTIONS.every((option) => option.headline.length > 0)).toBe(true)
    expect(
      AIM_OPTIONS.some((option) => /step 1|continue|next/i.test(option.label))
    ).toBe(false)
  })

  it("parses storage as unresolved until skip or an aim is chosen", () => {
    expect(parseAimPromptState(null)).toEqual({
      resolved: false,
      aimId: null,
    })
    expect(parseAimPromptState("{")).toEqual({
      resolved: false,
      aimId: null,
    })
    expect(
      parseAimPromptState(JSON.stringify({ resolved: true, aimId: "wizard" }))
    ).toEqual({ resolved: true, aimId: null })
    expect(
      parseAimPromptState(
        JSON.stringify({ resolved: true, aimId: "product-intern" })
      )
    ).toEqual({ resolved: true, aimId: "product-intern" })
    expect(
      parseAimPromptState(
        JSON.stringify({ resolved: true, aimId: "cafe-part-time" })
      )
    ).toEqual({ resolved: true, aimId: "cafe-part-time" })
  })

  it("resolves skip without an aim and remembers a chosen aim", () => {
    const started = parseAimPromptState(null)
    const skipped = resolveAimPrompt(started, null)
    expect(skipped).toEqual({ resolved: true, aimId: null })
    expect(resolveAimPrompt(skipped, null)).toBe(skipped)

    const chosen = resolveAimPrompt(started, "summer-intern")
    expect(chosen).toEqual({ resolved: true, aimId: "summer-intern" })
    expect(resolveAimPrompt(chosen, "summer-intern")).toBe(chosen)
  })

  it("maps an aim to a headline", () => {
    expect(headlineForAim("summer-intern")).toBe(
      "Looking for a summer internship"
    )
    expect(headlineForAim("cafe-part-time")).toBe(
      "Working café shifts while I study"
    )
  })

  it("persists skip so the prompt appears once", () => {
    const userId = "user_fresh"
    writeAimPromptState(
      userId,
      resolveAimPrompt(parseAimPromptState(null), null)
    )
    expect(readAimPromptState(userId)).toEqual({
      resolved: true,
      aimId: null,
    })
  })

  it("does not add an /onboarding route to the app shell", () => {
    const fromWeb = path.join(process.cwd(), "src/router.tsx")
    const fromRoot = path.join(process.cwd(), "apps/web/src/router.tsx")
    const routerSrc = readFileSync(
      existsSync(fromWeb) ? fromWeb : fromRoot,
      "utf8"
    )
    expect(routerSrc).not.toMatch(/onboarding/i)
  })
})
