import { expect, it } from "vitest"
import { NATIVE_WRITER } from "@workspace/domain/paper-doc"
import {
  requireNativeIdentity,
  nativeRecoveryScope,
  nativeRuntimeScope,
  sameNativeSession,
} from "./paper-sync-identity.ts"

const identity = requireNativeIdentity({
  kind: "native",
  ownerId: "one",
  sessionId: "session-a",
  docId: "00000000-0000-4000-8000-000000000001",
  writer: NATIVE_WRITER,
  provenance: {
    documentVersion: 4,
    schemaRevision: 1,
    writerProtocol: 1,
    requiredCapabilities: ["structured-prose", "underline"],
  },
})

it("recovers the same owner's format after sign-in while detaching old runtime responses", () => {
  const next = { ...identity, sessionId: "session-b" }
  expect(nativeRecoveryScope(next)).toBe(nativeRecoveryScope(identity))
  expect(nativeRuntimeScope(next)).not.toBe(nativeRuntimeScope(identity))
  expect(sameNativeSession(identity, next)).toBe(false)
  expect(nativeRecoveryScope({ ...identity, ownerId: "two" })).not.toBe(
    nativeRecoveryScope(identity)
  )
})
it("refuses missing identity, unsupported capabilities and provenance without choosing legacy", () => {
  for (const value of [
    undefined,
    { kind: "legacy" },
    { ...identity, ownerId: "" },
    { ...identity, sessionId: "" },
    { ...identity, provenance: { ...identity.provenance, schemaRevision: 2 } },
    { ...identity, writer: { ...NATIVE_WRITER, capabilities: [] } },
  ])
    expect(() => requireNativeIdentity(value)).toThrow()
})
