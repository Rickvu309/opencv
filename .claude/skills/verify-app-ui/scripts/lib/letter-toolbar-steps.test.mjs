import assert from "node:assert/strict"
import { test } from "node:test"

import { linkedWords, spacedCount } from "./letter-toolbar-steps.mjs"

const blocks = (...items) =>
  items.map((content, index) => ({
    id: `p${index}`,
    type: "paragraph",
    content: Array.isArray(content) ? content : [{ text: content }],
  }))

test("spacedCount counts a keyword only when spaces, punctuation or the block edge fence it", () => {
  assert.deepEqual(spacedCount(blocks("words here Meta Ads"), "Meta Ads"), {
    loose: 1,
    spaced: 1,
  })
  assert.deepEqual(spacedCount(blocks("hereMeta Ads"), "Meta Ads"), {
    loose: 1,
    spaced: 0,
  })
  assert.deepEqual(spacedCount(blocks("Meta Ads", "(Meta Ads)."), "Meta Ads"), {
    loose: 2,
    spaced: 2,
  })
})

test("linkedWords returns the words of one block that carry the link", () => {
  const linked = blocks([
    { text: "I'm " },
    { text: "applying", href: "https://example.com" },
    { text: " for" },
  ])
  assert.equal(linkedWords(linked, "I'm", "https://example.com"), "applying")
  assert.equal(linkedWords(linked, "Nope", "https://example.com"), null)
})
