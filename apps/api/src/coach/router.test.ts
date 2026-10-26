import type { LanguageModel } from "ai"
import { describe, expect, it } from "vitest"

import { CommandError } from "../registry/errors.js"
import { interpretPosting, routeCoachModel, titleFromModel } from "./router.js"

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

describe("free reads", () => {
  const factories = {
    openrouter: (modelId: string) => stub(modelId),
    anthropic: (modelId: string) => stub(modelId),
  }

  it("titles a chat on the free route", async () => {
    const title = await titleFromModel({
      plan: "free",
      userText: "Help me prepare for a product intern interview",
      coachText: "Prep the starred one next.",
      env: { OPENROUTER_API_KEY: "test" },
      factories,
      complete: async () => "Interview prep",
    })
    expect(title).toBe("Interview prep")
  })

  it("reads a posting on the free route", async () => {
    const fields = await interpretPosting({
      plan: "free",
      text: "Northwind Labs is hiring an Intern in Hanoi.",
      env: { OPENROUTER_API_KEY: "test" },
      factories,
      complete: async () =>
        '{"company":"Northwind Labs","title":"Intern","location":"Hanoi"}',
    })
    expect(fields).toEqual({
      company: "Northwind Labs",
      title: "Intern",
      location: "Hanoi",
    })
  })
})
