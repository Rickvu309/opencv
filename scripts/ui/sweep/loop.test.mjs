import assert from "node:assert/strict"
import test from "node:test"

import { writeZip } from "../../lib/paper-canvas-bytes.mjs"
import {
  COACH_WORDS,
  LOOP_STEPS,
  TYPED_LINE,
  coreLoop,
  wordText,
} from "./loop.mjs"

const HEADING = "Exchange term, Lyon"

const wordFile = (lines) =>
  writeZip([
    [
      "word/document.xml",
      Buffer.from(
        `<w:document><w:body>${lines
          .map(
            (line) =>
              `<w:p><w:r><w:t xml:space="preserve">${line.slice(0, 4)}</w:t></w:r><w:r><w:t>${line.slice(4)}</w:t></w:r></w:p>`
          )
          .join("")}</w:body></w:document>`
      ),
    ],
  ])

function healthyDriver() {
  const seen = { typed: false, approved: false, closed: false }
  return {
    seen,
    signIn: async () => {},
    importFile: async () => {},
    waitForPage: async () => ({ ok: true, docId: "doc-1" }),
    openFromLibrary: async (docId) => docId === "doc-1",
    openByAddress: async () => {},
    typeLine: async () => {
      seen.typed = true
    },
    storedText: async () =>
      seen.typed ? `${HEADING}\n${TYPED_LINE}` : HEADING,
    askCoachForEdit: async () => {},
    approve: async () => {
      seen.approved = true
    },
    pageText: async () =>
      seen.approved ? `${HEADING} ${COACH_WORDS}\n${TYPED_LINE}` : HEADING,
    undoOffered: async () => seen.approved,
    downloadWord: async () =>
      wordFile([`${HEADING} ${COACH_WORDS}`, TYPED_LINE]),
    screenshot: async (name) => `/shots/${name}.png`,
    close: async () => {
      seen.closed = true
    },
  }
}

const worldWith = (driver) => ({
  now: () => 0,
  loopDriver: async () => driver,
})

test("the Word reader joins split runs into lines", () => {
  assert.equal(
    wordText(
      wordFile(
        ["Hello there", "A & B"].map((line) => line.replace("&", "&amp;"))
      )
    ),
    "Hello there\nA & B"
  )
})

test("a healthy app passes every loop step and closes the browser", async () => {
  const driver = healthyDriver()
  const result = await coreLoop(worldWith(driver), "cv-formatted.docx")
  assert.equal(result.ok, true, result.problem)
  assert.equal(result.screen, "loop cv-formatted.docx")
  assert.equal(driver.seen.closed, true)
})

const BREAKS = {
  "sign in": {
    signIn: async () => {
      throw new Error("no pool account within 180s")
    },
  },
  "bring the file in on Paper": {
    importFile: async () => {
      throw new Error("no file input on /paper")
    },
  },
  "open the imported page": {
    waitForPage: async () => ({ ok: false, shows: "Document not found." }),
  },
  "the library lists it and opens it": { openFromLibrary: async () => false },
  "reopen it by its address": {
    openByAddress: async () => {},
    waitForPage: (() => {
      let calls = 0
      return async () =>
        ++calls < 3
          ? { ok: true, docId: "doc-1" }
          : { ok: false, shows: "Document not found." }
    })(),
  },
  "type a line and see Saved": { storedText: async () => HEADING },
  "the Coach proposes an edit and it is approved": {
    undoOffered: async () => false,
  },
  "download Word and read it back": {
    downloadWord: async () => wordFile([HEADING]),
  },
}

test("every loop step has a case that breaks it alone", () => {
  assert.deepEqual(
    Object.keys(BREAKS),
    LOOP_STEPS.map((step) => step.name)
  )
})

for (const [at, step] of LOOP_STEPS.entries())
  test(`a broken "${step.name}" fails at step ${at + 1} with a screenshot and nothing earlier`, async () => {
    const driver = { ...healthyDriver(), ...BREAKS[step.name] }
    const result = await coreLoop(worldWith(driver), "cv-formatted.docx")
    assert.equal(result.ok, false)
    assert.match(
      result.problem,
      new RegExp(`^core loop step ${at + 1} "${step.name}" failed: `)
    )
    assert.equal(
      result.shot,
      `/shots/loop-cv-formatted.docx-step-${at + 1}.png`
    )
    assert.equal(
      result.repro,
      "node scripts/ui.mjs sweep loop --file cv-formatted.docx"
    )
  })

test("the incident reads as the page that never opened", async () => {
  const driver = { ...healthyDriver(), ...BREAKS["open the imported page"] }
  const result = await coreLoop(worldWith(driver), "cv-formatted.docx")
  assert.equal(
    result.problem,
    'core loop step 3 "open the imported page" failed: after the import: the page shows "Document not found." instead of a Word page with "Exchange term, Lyon"'
  )
})

test("an unknown file is refused before a browser opens", async () => {
  await assert.rejects(
    coreLoop(worldWith(healthyDriver()), "cv.odt"),
    /no file cv.odt/
  )
})
