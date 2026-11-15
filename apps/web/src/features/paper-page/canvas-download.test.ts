import { expect, it } from "vitest"

import { wordDownloadRevision } from "./canvas-download.ts"

const REVISION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const BASIS = { revision: REVISION, words: "Saved words" }

it.each([
  ["This page changed while you had unsent words.", "Saved words", BASIS],
  ["Kept on this computer.", "Saved words", BASIS],
  ["Saved", "My unsent words", BASIS],
  ["Saved", "Saved words", { ...BASIS, revision: null }],
  ["Saved", "Saved words", null],
])("holds Word download for %s with %s", (note, words, basis) => {
  expect(wordDownloadRevision(note, words, basis)).toBeNull()
})

it("returns only the canvas basis revision for its exact Saved words", () => {
  expect(wordDownloadRevision("Saved", BASIS.words, BASIS)).toBe(REVISION)
})
