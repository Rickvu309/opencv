import assert from "node:assert/strict"
import test from "node:test"
import { z } from "zod"

import { defineOperation, type Implementations } from "./operation.js"

const operation = defineOperation({
  owner: "fixture",
  name: "fixture.echo",
  kind: "read",
  version: 1,
  description: "Echo a value",
  coach: "auto",
  input: z.object({ count: z.string().default("1") }),
  publicResult: z.object({ count: z.number() }),
  dependsOn: (input) => [{ name: input.count, coachFloor: "auto" }],
})

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
type Catalog = { [operation.name]: typeof operation }
const nameInferred: Equal<keyof Catalog, "fixture.echo"> = true
const inputInferred: Equal<
  z.input<typeof operation.input>,
  { count?: string }
> = true
const parsedInputInferred: Equal<
  z.output<typeof operation.input>,
  { count: string }
> = true
const outputInferred: Equal<
  z.output<typeof operation.publicResult>,
  { count: number }
> = true
const dependencyInputInferred: Equal<
  Parameters<typeof operation.dependsOn>[0],
  { count: string }
> = true
const rejectsWrongOutput: Equal<
  ((input: { count: string }) => {
    count: string
  }) extends Implementations<Catalog>["fixture.echo"]["execute"]
    ? true
    : false,
  false
> = true

test("operation names, wire input, parsed input and public results retain their types", async () => {
  assert.ok(
    nameInferred &&
      inputInferred &&
      parsedInputInferred &&
      outputInferred &&
      dependencyInputInferred &&
      rejectsWrongOutput
  )
  const implementations = {
    "fixture.echo": {
      operation,
      execute: (input) => ({ count: Number(input.count) }),
    },
  } satisfies Implementations<Catalog>
  assert.deepEqual(operation.input.parse({}), { count: "1" })
  assert.deepEqual(
    await implementations[operation.name].execute({ count: "2" }),
    { count: 2 }
  )
  assert.deepEqual(operation.dependsOn({ count: "2" }), [
    { name: "2", coachFloor: "auto" },
  ])
})

test("operation versions and destructive command policy are validated independently of source digests", () => {
  assert.throws(() => defineOperation({ ...operation, version: 0 }))
  assert.throws(() => defineOperation({ ...operation, owner: "../account" }))
  assert.throws(() =>
    defineOperation({
      ...operation,
      kind: "command",
      coach: "auto",
      destructive: true,
      idempotency: "keyed",
      writes: () => [],
    })
  )
  const command = defineOperation({
    owner: "fixture",
    name: "fixture.update",
    kind: "command",
    version: 2,
    description: "Update a value",
    input: z.object({ count: z.number() }),
    publicResult: z.object({ updated: z.boolean() }),
    coach: "confirm",
    destructive: false,
    idempotency: "keyed",
    writes: (input) => [{ name: String(input.count), coachFloor: "confirm" }],
  })
  assert.equal(command.version, 2)
  assert.deepEqual(command.writes({ count: 3 }), [
    { name: "3", coachFloor: "confirm" },
  ])
})
