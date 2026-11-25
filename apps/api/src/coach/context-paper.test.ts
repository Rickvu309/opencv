import { personActor } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { resolveTurnGrounding } from "./context.js"

describe("the Coach's view of an attached file", () => {
  it("names an attached file by name, type and size and never carries its bytes", async () => {
    const registry = {
      read: async (name: string) =>
        name === "file.get"
          ? {
              name: "cv.pdf",
              mediaType: "application/pdf",
              byteSize: 12,
              bytes: "SECRET-FILE-BYTES",
            }
          : null,
    } as unknown as Parameters<typeof resolveTurnGrounding>[0]["registry"]
    const grounding = await resolveTurnGrounding({
      registry,
      actor: personActor("user-coach-context"),
      requestFocusDocId: undefined,
      storedKind: null,
      storedId: null,
      context: [{ kind: "file", id: "file-1" }],
      memoryEnabled: false,
    })
    expect(grounding.note).toContain(
      "File: cv.pdf (application/pdf, 12 bytes)."
    )
    expect(grounding.note).not.toContain("SECRET-FILE-BYTES")
  })
})
