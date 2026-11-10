import {
  defineOperation,
  type AcceptsOperation,
  type Actor,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { requireStatedBinding, type OperationBinding } from "./bind.js"
import type { ExecuteOptions } from "./registry-types.js"

const command = defineOperation({
  owner: "fixture",
  name: "fixture.update",
  kind: "command",
  version: 1,
  description: "Update a value",
  input: z.object({ count: z.number() }),
  publicResult: z.object({ updated: z.boolean() }),
  coach: "confirm",
  destructive: false,
  idempotency: "keyed",
  writes: () => [{ name: "fixture", coachFloor: "confirm" }],
})

type MissingUndo = {
  operation: typeof command
  execute: (
    input: { count: number },
    actor: Actor
  ) => Promise<{ updated: boolean }>
  activity: { silent: string }
}

type RejectsMissingUndo =
  MissingUndo extends OperationBinding<typeof command, { updated: boolean }>
    ? false
    : true

const rejectsMissingUndo: RejectsMissingUndo = true

const optionsHideTheBypass: Extract<
  keyof ExecuteOptions,
  "skipConfirm" | "skipActivity"
> extends never
  ? true
  : false = true

type PolicyShape = {
  owner: "fixture"
  name: "fixture.update"
  version: 1
  kind: "command"
  description: "Update a value"
  input: z.ZodType<{ count: number }>
  publicResult: z.ZodType<{ updated: boolean }>
  idempotency: "keyed"
  writes: (input: { count: number }) => readonly {
    name: string
    coachFloor: "confirm"
  }[]
}

const rejectsAutoDestructive: AcceptsOperation<
  PolicyShape & { coach: "auto"; destructive: true }
> = false
const acceptsConfirmedDestructive: AcceptsOperation<
  PolicyShape & { coach: "confirm"; destructive: true }
> = true

const accepted = {
  operation: command,
  execute: async () => ({ updated: true }),
  reversal: { irreversible: "The fixture does not undo" },
  activity: { silent: "The fixture records no receipt" },
} satisfies OperationBinding<typeof command, { updated: boolean }>

describe("command bindings", () => {
  it("hides the confirm bypass from callers", () => {
    expect(optionsHideTheBypass).toBe(true)
  })

  it("refuses to bind a command whose Undo or receipt escaped the type", () => {
    const stated = {
      reversal: { irreversible: "The fixture does not undo" },
      activity: { silent: "The fixture records no receipt" },
    }
    expect(() => requireStatedBinding("fixture.update", stated)).not.toThrow()
    expect(() =>
      requireStatedBinding("fixture.update", {
        reversal: () => null,
        activity: () => null,
      })
    ).not.toThrow()
    expect(() =>
      requireStatedBinding("fixture.update", { activity: stated.activity })
    ).toThrow(/fixture\.update needs an Undo/)
    expect(() =>
      requireStatedBinding("fixture.update", {
        reversal: { irreversible: "none" },
        activity: stated.activity,
      })
    ).toThrow(/needs an Undo/)
    expect(() =>
      requireStatedBinding("fixture.update", { reversal: stated.reversal })
    ).toThrow(/needs an activity receipt/)
  })

  it("rejects a command with no Undo", () => {
    expect(rejectsMissingUndo).toBe(true)
    expect(rejectsAutoDestructive).toBe(false)
    expect(acceptsConfirmedDestructive).toBe(true)
    expect(accepted.reversal).toEqual({
      irreversible: "The fixture does not undo",
    })
  })
})
