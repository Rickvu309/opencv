import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  COACH_TWO_PAGES_PAST_STORED_JSON_CHARS,
  coachPagesFromStoredJson,
  mediaTypeFromImageBytes,
} from "./store.js"

const storeSource = readFileSync(new URL("./store.ts", import.meta.url), "utf8")

describe("coach page estimate from stored JSON", () => {
  it("counts one page through 3500 characters and two pages past that", () => {
    expect(COACH_TWO_PAGES_PAST_STORED_JSON_CHARS).toBe(3500)
    expect(coachPagesFromStoredJson(3500)).toBe(1)
    expect(coachPagesFromStoredJson(3501)).toBe(2)
  })

  it("pageCount uses the stored JSON", () => {
    expect(storeSource).toContain(
      "coachPagesFromStoredJson(JSON.stringify(doc.crdtDocument).length)"
    )
  })
})

describe("avatar type from the bytes", () => {
  it("reads png, jpeg, webp and gif from the bytes", () => {
    expect(mediaTypeFromImageBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(
      "image/png"
    )
    expect(mediaTypeFromImageBytes(Buffer.from([0xff, 0xd8, 0xff]))).toBe(
      "image/jpeg"
    )
    const webp = Buffer.alloc(12)
    webp.write("RIFF", 0, "ascii")
    webp.write("WEBP", 8, "ascii")
    expect(mediaTypeFromImageBytes(webp)).toBe("image/webp")
    expect(mediaTypeFromImageBytes(Buffer.from("GIF89a"))).toBe("image/gif")
    expect(mediaTypeFromImageBytes(Buffer.from("GIF87a"))).toBe("image/gif")
  })

  it("saveFile stores the byte type for an avatar and drops the client type", () => {
    expect(storeSource).toContain("? mediaTypeFromImageBytes(input.bytes)")
    expect(storeSource).not.toContain('purpose === "avatar" ? input.mediaType')
  })
})
