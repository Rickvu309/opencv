import type { LanguageModel } from "ai"
import { describe, expect, it } from "vitest"

import { CommandError } from "../registry/errors.js"
import { routeCoachModel } from "./router.js"

const stub = (id: string) => ({ id }) as unknown as LanguageModel

describe("routeCoachModel", () => {
  it("builds the free model through the injected factory", () => {
    const seen: string[] = []
    const model = routeCoachModel({
      plan: "free",
      mode: "free",
      env: { COACH_MODEL_FREE: "openrouter/free" },
      factories: {
        openrouter(modelId) {
          seen.push(modelId)
          return stub(modelId)
        },
        anthropic() {
          throw new Error("anthropic should not be called")
        },
      },
    })
    expect(seen).toEqual(["openrouter/free"])
    expect(model).toEqual({ id: "openrouter/free" })
  })

  it("refuses a pro plan when the Anthropic key is missing", () => {
    expect(() =>
      routeCoachModel({
        plan: "pro",
        mode: "max",
        env: {},
        factories: {
          openrouter: () => stub("no"),
          anthropic: () => stub("no"),
        },
      })
    ).toThrow(CommandError)
  })

  it("refuses light mode on a free plan", () => {
    expect(() =>
      routeCoachModel({
        plan: "free",
        mode: "light",
        env: {},
        factories: {
          openrouter: () => stub("no"),
          anthropic: () => stub("no"),
        },
      })
    ).toThrow(CommandError)
  })
})
