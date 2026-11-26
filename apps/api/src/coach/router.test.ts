import { type Plan } from "@workspace/domain/account"
import { COACH_MODEL, type CoachMode } from "@workspace/domain/coach"
import { describe, expect, it, vi } from "vitest"
import { FixtureCoachModel } from "./anthropic-fixture.js"
import { CommandError } from "../platform/errors.js"
import { routeCoachModel, interpretPosting } from "./router.js"

const model = new FixtureCoachModel({ doStream: async () => ({ stream: [] }) })

describe("Coach model routing", () => {
  it.each<[Plan, CoachMode]>([
    ["free", "free"],
    ["pro", "free"],
    ["pro", "light"],
    ["pro", "max"],
  ])("routes %s %s to the owner model", (plan, mode) => {
    const anthropic = vi.fn(() => model)
    expect(
      routeCoachModel({
        plan,
        mode,
        env: { ANTHROPIC_API_KEY: "test" },
        factories: { anthropic },
      })
    ).toBe(model)
    expect(anthropic).toHaveBeenCalledWith(COACH_MODEL)
  })
  it("requires an Anthropic key", () => {
    expect(() =>
      routeCoachModel({ plan: "free", mode: "free", env: {} })
    ).toThrow(CommandError)
  })
  it("preserves plan entitlement", () => {
    expect(() =>
      routeCoachModel({
        plan: "free",
        mode: "light",
        env: { ANTHROPIC_API_KEY: "test" },
      })
    ).toThrow(CommandError)
  })
  it("extracts posting fields through the same route", async () => {
    const anthropic = vi.fn(() => model)
    expect(
      await interpretPosting({
        plan: "free",
        text: "Posting",
        env: { ANTHROPIC_API_KEY: "test" },
        factories: { anthropic },
        complete: async () =>
          '{"title":"Intern","company":"Northwind","location":"Hanoi"}',
      })
    ).toEqual({ title: "Intern", company: "Northwind", location: "Hanoi" })
    expect(anthropic).toHaveBeenCalledWith(COACH_MODEL)
  })
})
