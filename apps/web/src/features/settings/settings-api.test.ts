import { afterEach, describe, expect, it, vi } from "vitest"

import {
  downloadExport,
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
      filenameFromDisposition('attachment; filename="opencv-export.zip"')
    ).toBe("opencv-export.zip")
    expect(filenameFromDisposition(null)).toBe(EXPORT_FILENAME)
  })

  it.each([
    [429, "An export is already being prepared. Try again when it finishes."],
    [503, "Other exports are being prepared right now. Try again in a minute."],
  ])(
    "shows the server's own words when the export is refused with %i",
    async (status, message) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json(
            { ok: false, error: { code: "EXPORT_BUSY", message } },
            { status, headers: { "retry-after": "30" } }
          )
        )
      )
      await expect(downloadExport()).rejects.toMatchObject({ status, message })
    }
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})
