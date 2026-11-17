import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const here = path.dirname(fileURLToPath(import.meta.url))
const history = readFileSync(
  path.join(here, "design/coach-history.pen.css"),
  "utf8"
)
const menus = readFileSync(
  path.join(here, "design/composer-menus.pen.css"),
  "utf8"
)
const token = "color-mix(in srgb, var(--muted-foreground) 87%, transparent)"

describe("Coach label contrast", () => {
  it("uses the muted foreground token for history and menu labels", () => {
    for (const slot of [
      "history-search",
      "history-section-label",
      "history-item-time",
      "history-shortcut",
    ]) {
      expect(history).toContain(`[data-slot="${slot}"]`)
      expect(history).toContain(token)
    }
    expect(history).not.toMatch(/history-section-label[\s\S]{0,80}#8a8a8e/)
    expect(history).not.toMatch(/history-item-time[\s\S]{0,80}#a0a0a2/)
    expect(menus).toContain("[data-add-recent-label]")
    expect(menus).toContain("[data-add-status]")
    expect(menus).toContain(token)
    expect(menus).not.toMatch(/data-add-recent-label[\s\S]{0,160}#a0a0a2/)
    expect(menus).not.toMatch(/data-add-status[\s\S]{0,120}#a0a0a2/)
  })
})
