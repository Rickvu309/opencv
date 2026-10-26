import { describe, expect, it } from "vitest"

import {
  EXPORT_FILENAME,
  filenameFromDisposition,
  PHOTO_REJECTION,
  photoRejection,
} from "./settings-api.ts"

describe("settings api guards", () => {
  it("rejects a photo over 2 MB and a file that is not an image", () => {
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    })
    expect(photoRejection(big)).toBe(PHOTO_REJECTION)
    const text = new File(["hi"], "notes.txt", { type: "text/plain" })
    expect(photoRejection(text)).toBe(PHOTO_REJECTION)
    const ok = new File([new Uint8Array(12)], "ok.png", { type: "image/png" })
    expect(photoRejection(ok)).toBeNull()
  })

  it("reads the export filename from content-disposition", () => {
    expect(
      filenameFromDisposition('attachment; filename="opencv-export.json"')
    ).toBe("opencv-export.json")
    expect(filenameFromDisposition(null)).toBe(EXPORT_FILENAME)
  })
})
