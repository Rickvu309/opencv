import { linkedWords, spacedCount } from "./letter-toolbar-steps.mjs"

const blocks = (...items) =>
  items.map((content, index) => ({
    id: `p${index}`,
    type: "paragraph",
    content: Array.isArray(content) ? content : [{ text: content }],
  }))

const keywordOnce = (found) => found.loose === 1 && found.spaced === 1

export const badFixture = [
  {
    name: "a keyword glued to the word before it",
    fails: () =>
      !keywordOnce(spacedCount(blocks("words hereMeta Ads"), "Meta Ads")),
  },
  {
    name: "a keyword inserted twice",
    fails: () =>
      !keywordOnce(spacedCount(blocks("words Meta Ads Meta Ads"), "Meta Ads")),
  },
  {
    name: "a link that covers more than the selected word",
    fails: () =>
      linkedWords(
        blocks([
          { text: "I'm " },
          { text: "applying for", href: "https://example.com" },
        ]),
        "I'm",
        "https://example.com"
      ) !== "applying",
  },
]
