import { createRequire } from "node:module"
import { randomUUID } from "node:crypto"

import { delegateActorSchema, personActor } from "@workspace/domain/kernel"
import { describe, expect, it } from "vitest"

import { paperRegistry } from "../paper-registry.test-support.js"
import { PaperPackage } from "./package-engine.js"
import { PACKAGE_PROFILE } from "./package-profile.js"
import { archiveDigest } from "./package-pages.js"

const loaded = createRequire(import.meta.url)(
  "../../../../../scripts/lib/paper-canvas-bytes.mjs"
) as {
  applyCanvasBytes: (
    bytes: Uint8Array,
    edit: { op: string; paragraph: string; at?: number },
    side: {
      version: 2
      paragraphs: { key: string; ordinal: number; textIds: string[] }[]
    }
  ) => {
    status: string
    bytes: Uint8Array
    sidecar: {
      version: 2
      paragraphs: { key: string; ordinal: number; textIds: string[] }[]
    }
  }
  mintBlankBytes: () => Uint8Array
}

function registry() {
  const value = paperRegistry()
  return value
}

function delegate() {
  return delegateActorSchema.parse({
    type: "delegate",
    userId: "canvas-agent",
    connectionId: randomUUID(),
    name: "agent",
    scopes: ["paper.write"],
    resources: "jobs",
    reads: "allow",
    writes: "approval",
  })
}

describe("paper.canvas", () => {
  it("is a person command", async () => {
    const names = (await registry().tools(personActor("canvas-person"))).map(
      (entry) => entry.name
    )
    expect(names).toContain("paper.canvas")
    expect(
      (await registry().tools(delegate())).map((entry) => entry.name)
    ).not.toContain("paper.canvas")
  })

  it("refuses a delegate before saving", async () => {
    await expect(
      registry().execute({
        name: "paper.canvas",
        input: { op: "mint", label: "letter" },
        actor: delegate(),
      })
    ).rejects.toThrow("This connection cannot use this command")
  })

  it("opens a split blank page when the new line has no Word id", async () => {
    const docId = randomUUID()
    const incarnation = randomUUID()
    const revision = randomUUID()
    const minted = loaded.mintBlankBytes()
    const opened = await PaperPackage.open(minted, {
      docId,
      incarnation,
      revision,
    })
    expect(opened.read().regions).toHaveLength(1)
    const side = opened.sidecar()
    const applied = loaded.applyCanvasBytes(
      minted,
      { op: "split", paragraph: side.paragraphs[0]!.key, at: 0 },
      {
        version: 2,
        paragraphs: side.paragraphs.map((row) => ({
          key: row.key,
          ordinal: row.ordinal,
          textIds: [...row.textIds],
        })),
      }
    )
    expect(applied.status).toBe("APPLIED")
    const next = randomUUID()
    const again = await PaperPackage.open(
      applied.bytes,
      { docId, incarnation, revision: next },
      {
        version: 2,
        profile: PACKAGE_PROFILE.version,
        revision: next,
        docId,
        incarnation,
        packageHash: archiveDigest(applied.bytes),
        paragraphs: applied.sidecar.paragraphs,
      }
    )
    expect(again.sidecar().paragraphs).toHaveLength(2)
    expect(again.read().regions.length).toBeGreaterThan(0)
  })
})
