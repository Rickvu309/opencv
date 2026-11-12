import { describe, expect, it } from "vitest"

import { parseSessionReply, sessionToKeep } from "@/lib/session-check.ts"
import type { KnownSession } from "@/lib/known-session.ts"

const session = {
  user: { id: "user_1" },
  session: { id: "session_1" },
} as unknown as KnownSession

describe("parseSessionReply", () => {
  it("reads a session as signed in", () => {
    expect(parseSessionReply({ data: session, error: null }, null)).toEqual({
      kind: "signed-in",
      session,
    })
  })

  it("reads an answered empty session as signed out", () => {
    expect(parseSessionReply({ data: null, error: null }, session)).toEqual({
      kind: "signed-out",
    })
    expect(
      parseSessionReply({ data: null, error: { status: 401 } }, session)
    ).toEqual({ kind: "signed-out" })
  })

  it.each([429, 500, 503, 0, undefined])(
    "reads status %s as unknown and keeps the last known session",
    (status) => {
      const check = parseSessionReply(
        { data: null, error: { status } },
        session
      )
      expect(check).toEqual({ kind: "unknown", lastKnown: session })
      expect(sessionToKeep(check)).toBe(session)
    }
  )

  it("reads a body that is not a session as unknown", () => {
    expect(parseSessionReply({ data: "<html>", error: null }, null)).toEqual({
      kind: "unknown",
      lastKnown: null,
    })
  })
})
