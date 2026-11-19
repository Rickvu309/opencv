import { expect, it } from "vitest"

import { documentEditedLabel } from "./document-edited.ts"

const now = Date.parse("2026-11-19T12:00:00.000Z")
const ago = (ms: number) => new Date(now - ms).toISOString()

it("names how long ago the document was edited in plain words", () => {
  expect(documentEditedLabel(ago(20_000), now)).toBe("Edited just now")
  expect(documentEditedLabel(ago(5 * 60_000), now)).toBe("Edited 5 minutes ago")
  expect(documentEditedLabel(ago(3_600_000), now)).toBe("Edited 1 hour ago")
  expect(documentEditedLabel(ago(86_400_000), now)).toBe("Edited yesterday")
  expect(documentEditedLabel(ago(3 * 86_400_000), now)).toBe(
    "Edited 3 days ago"
  )
  expect(documentEditedLabel(ago(400 * 86_400_000), now)).toBe(
    "Edited last year"
  )
})

it("treats a clock ahead of the server as just now and a bad time as unknown", () => {
  expect(documentEditedLabel(ago(-90_000), now)).toBe("Edited just now")
  expect(documentEditedLabel("not a time", now)).toBeNull()
})
