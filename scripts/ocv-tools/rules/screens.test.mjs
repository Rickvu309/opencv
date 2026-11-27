import { readFileSync } from "node:fs"
import assert from "node:assert/strict"
import test from "node:test"
import { decide, evaluate } from "./index.mjs"
import { shownUiFiles } from "./screens.mjs"

const FILES = [
  "apps/web/src/features/paper/paper-library-sections.tsx",
  "apps/web/src/components/ai-elements/message.tsx",
  "packages/ui/src/components/button.tsx",
  "packages/ui/src/styles/globals.css",
]
const TEST_FILE = "apps/web/src/features/paper/paper-library.test.tsx"
const LEAD = readFileSync(
  new URL("pr-body-fixtures/tree.txt", import.meta.url),
  "utf8"
)
const SCREENSHOTS = "https://github.com/Rickvu309/opencv/releases/download"
const PICTURE = `![Paper after](${SCREENSHOTS}/screenshots/paper.png)`
const section = (content) => `${LEAD}\n\n## Before / after\n\n${content}\n`

function facts(text, files = FILES) {
  return {
    body: { file: "/body.md", text },
    pull: { title: "feat: preview Paper cards (#7)" },
    migrations: { files: [] },
    diff: { files },
  }
}

const refusal = (text, files) => evaluate("NO_BEFORE_AFTER", facts(text, files))

test("screen source includes app features, components and kit styles", () => {
  assert.deepEqual(
    shownUiFiles([
      ...FILES,
      TEST_FILE,
      "packages/ui/src/components/button-spec.tsx",
      "packages/ui/src/__tests__/button.tsx",
      "apps/web/src/features/paper/paper.ts",
      "apps/web/src/routes/paper.tsx",
      "apps/api/src/paper/page.tsx",
    ]),
    FILES
  )
})

test("a changed screen needs a visible Before / after section", () => {
  const missing = refusal(LEAD)
  assert.match(missing.message, /Add a ## Before \/ after section/)
  assert.match(missing.fix, /node scripts\/ui\.mjs shot <screen>/)
  assert.match(
    missing.fix,
    /node scripts\/ocv-tools\.mjs shot <png> --no-comment/
  )
  assert.match(refusal(section("")).message, /Add a published screenshot/)
  assert.match(
    refusal([LEAD, "```markdown", section(PICTURE), "```"].join("\n")).message,
    /Add a ## Before \/ after section/
  )
})

test("the section accepts an image published by shot", () => {
  assert.equal(refusal(section(PICTURE)), null)
  assert.equal(
    refusal(
      section(`<img src="${SCREENSHOTS}/screenshots/paper.png" alt="Paper">`)
    ),
    null
  )
  assert.equal(
    refusal(section(PICTURE.replace("/screenshots/", "/screenshots-2/"))),
    null
  )
  assert.equal(
    refusal(section(PICTURE.replace("/screenshots/", "/screenshots-10/"))),
    null
  )
})

test("the screenshot belongs to the section and the repository release", () => {
  const asset = `${SCREENSHOTS}/screenshots/paper.png`
  const wrong = [
    "![Paper](https://example.com/paper.png)",
    PICTURE.replace("/opencv/", "/other-repo/"),
    PICTURE.replace("/screenshots/", "/v1/"),
    PICTURE.replace("github.com/", "github.com.example.com/"),
    asset,
    `## Detail\n\n${PICTURE}`,
    ["```markdown", PICTURE, "```"].join("\n"),
    `    ${PICTURE}`,
    "`" + PICTURE + "`",
  ]
  for (const content of wrong)
    assert.match(
      refusal(section(content)).message,
      /Add a published screenshot/
    )
})

test("a reason needs four words on the same line", () => {
  assert.equal(
    refusal(section("No visible change: The card markup moved unchanged.")),
    null
  )
  for (const content of [
    "ok",
    "ok\n\nThe card markup moved unchanged.",
    "... ... ... ...",
  ])
    assert.match(
      refusal(section(`No visible change: ${content}`)).message,
      /at least four words/
    )
})

test("test-only TSX changes need no picture", () => {
  assert.equal(refusal(LEAD, [TEST_FILE]), null)
})

test("a screen body with two pictures counts only non-empty lines", () => {
  const before = PICTURE.replace("after", "before").replace(
    "paper.png",
    "before.png"
  )
  const details = `<details><summary>Detail</summary>\n\n${"More detail.\n".repeat(26)}\n</details>`
  const text = `Closes #7\n\n${section(`${before}\n\n${PICTURE}`)}\n${details}`
  assert.deepEqual(decide("body", facts(text)).refusals, [])
  const atLimit = `${text}\n\n${"Evidence note.\n\n".repeat(20)}`
  assert.deepEqual(decide("body", facts(atLimit)).refusals, [])
  const overLimit = decide("body", facts(`${atLimit}One more line.\n`))
  assert.equal(overLimit.refusals[0].id, "BAD_BODY")
  assert.match(overLimit.refusals[0].message, /25 non-empty lines/)
})
