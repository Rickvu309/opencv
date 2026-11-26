import { ERROR_CODES } from "@workspace/domain/kernel"
import { expect, it } from "vitest"
import { z } from "zod"

import { CommandError } from "../platform/errors.js"
import { AGENT_RATE_LIMIT_MESSAGE, agentToolError } from "./agent-tool-error.js"

const privateText = [
  "secret",
  "/tmp/private",
  "Dear Ada",
  "user-other-person",
  "select ",
  "    at ",
]

function expectPlain(error: unknown) {
  const mapped = agentToolError(error)
  const text = JSON.stringify(mapped)
  for (const value of privateText) expect(text).not.toContain(value)
  expect(Object.keys(mapped).sort()).toEqual(["code", "error", "next"])
  return mapped
}

it("turns every failure into a stable code and next step without private text", () => {
  const zod = z
    .object({ text: z.literal("x") })
    .safeParse({ text: "secret Dear Ada" })
  if (zod.success) throw new Error("fixture must fail")
  expect(expectPlain(zod.error)).toMatchObject({ code: "invalid_input" })
  expect(
    expectPlain(
      new CommandError(
        ERROR_CODES.VALIDATION_ERROR,
        "text: Expected secret at /tmp/private"
      )
    )
  ).toMatchObject({ code: "invalid_input" })
  const sql = new Error(
    "duplicate key value violates unique constraint \"paper_heads_pkey\" select * from paper where user_id = 'user-other-person'"
  )
  sql.stack = `${sql.message}\n    at insert (/tmp/private/db.js:1:1)`
  expect(expectPlain(sql)).toMatchObject({
    code: "failed",
    error: "The tool failed.",
  })
  expect(
    expectPlain(
      new CommandError(ERROR_CODES.NOT_FOUND, "Document Dear Ada not found")
    )
  ).toMatchObject({ code: "not_found" })
  expect(
    expectPlain(new CommandError(ERROR_CODES.CONFLICT, "Basis conflict secret"))
  ).toMatchObject({ code: "reread" })
  expect(expectPlain("secret")).toMatchObject({ code: "failed" })
})

it("keeps authored guidance for revocation, limits and Word refusals", () => {
  expect(
    agentToolError(
      new CommandError(
        ERROR_CODES.FORBIDDEN,
        "This agent connection is no longer active"
      )
    )
  ).toMatchObject({
    code: "reconnect",
    error: expect.stringMatching(/no longer active/),
  })
  expect(agentToolError(new Error(AGENT_RATE_LIMIT_MESSAGE))).toEqual({
    code: "limited",
    error: AGENT_RATE_LIMIT_MESSAGE,
    next: expect.any(String),
  })
  expect(
    agentToolError(
      new CommandError(
        ERROR_CODES.CONFLICT,
        "This Word document has changed. Read it again before editing."
      )
    )
  ).toMatchObject({ code: "reread" })
  expect(
    agentToolError(
      new CommandError(
        ERROR_CODES.VALIDATION_ERROR,
        "This line sits in a table or a box. Paper will not change it."
      )
    )
  ).toMatchObject({ code: "unsupported" })
})
