import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const PUBLIC_DIR = resolve(__dirname, "../../../public")

const STORED_SAMPLE_IMAGES = [
  "award-trophy",
  "gift-celebration",
  "hallway-test",
  "mobile-checkout",
  "phone-ui",
  "sprint-board",
  "team-laptop",
  "team-meeting",
  "team-win",
  "whiteboard",
].map((name) => `/pitch/stories/${name}.jpg`)

describe("stored sample Pitch images", () => {
  it("still resolve for accounts whose sample was saved before the starter dropped photos", () => {
    const missing = STORED_SAMPLE_IMAGES.filter(
      (path) => !existsSync(resolve(PUBLIC_DIR, `.${path}`))
    )
    expect(missing).toEqual([])
  })
})
