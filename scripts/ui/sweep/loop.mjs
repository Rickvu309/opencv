import { mainXml } from "../../lib/paper-canvas-bytes.mjs"

export const LOOP_FILES = {
  "cv-formatted.docx": { heading: "Exchange term, Lyon" },
  "cv-text.pdf": { heading: "Student Assistant, Example University" },
}

export const TYPED_LINE = "Sweep typed this line"
export const COACH_WORDS = "Reviewed by the Coach."

export function wordText(bytes) {
  return [...mainXml(bytes).matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)]
    .map(([paragraph]) =>
      [...paragraph.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
        .map((run) => run[1])
        .join("")
    )
    .join("\n")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
}

const missing = (text, wanted) => wanted.filter((item) => !text.includes(item))

async function expectPage(driver, heading, how) {
  const opened = await driver.waitForPage(heading)
  if (!opened.ok)
    throw new Error(
      `${how}: the page shows ${JSON.stringify(opened.shows)} instead of a Word page with ${JSON.stringify(heading)}`
    )
  return opened
}

export const LOOP_STEPS = [
  {
    name: "sign in",
    run: (driver) => driver.signIn(),
  },
  {
    name: "bring the file in on Paper",
    run: (driver, memo) => driver.importFile(memo.file),
  },
  {
    name: "open the imported page",
    run: async (driver, memo) => {
      const opened = await expectPage(driver, memo.heading, "after the import")
      memo.docId = opened.docId
    },
  },
  {
    name: "the library lists it and opens it",
    run: async (driver, memo) => {
      if (!(await driver.openFromLibrary(memo.docId)))
        throw new Error(`Paper does not list the page ${memo.docId}`)
      await expectPage(driver, memo.heading, "opened from the library")
    },
  },
  {
    name: "reopen it by its address",
    run: async (driver, memo) => {
      await driver.openByAddress(memo.docId)
      await expectPage(driver, memo.heading, "opened by its address")
    },
  },
  {
    name: "type a line and see Saved",
    run: async (driver, memo) => {
      await driver.typeLine(TYPED_LINE)
      const stored = await driver.storedText(memo.docId)
      if (!stored.includes(TYPED_LINE))
        throw new Error(
          `the page said Saved, but the stored page does not hold ${JSON.stringify(TYPED_LINE)}`
        )
    },
  },
  {
    name: "the Coach proposes an edit and it is approved",
    run: async (driver) => {
      await driver.askCoachForEdit()
      await driver.approve()
      const after = await driver.pageText()
      if (!after.includes(COACH_WORDS))
        throw new Error(
          `after Approve the page does not show ${JSON.stringify(COACH_WORDS)}`
        )
      if (!(await driver.undoOffered()))
        throw new Error("after Approve the Coach offers no Undo")
    },
  },
  {
    name: "download Word and read it back",
    run: async (driver, memo) => {
      const text = wordText(await driver.downloadWord())
      const lost = missing(text, [memo.heading, TYPED_LINE, COACH_WORDS])
      if (lost.length)
        throw new Error(
          `the downloaded Word file is missing ${lost.map((item) => JSON.stringify(item)).join(", ")}`
        )
    },
  },
]

export const loopRepro = (file) =>
  `node scripts/ui.mjs sweep loop --file ${file}`

export async function coreLoop(world, file) {
  const known = LOOP_FILES[file]
  if (!known) throw new Error(`the core loop has no file ${file}`)
  const started = world.now()
  const driver = await world.loopDriver(file)
  const memo = { file, heading: known.heading }
  const base = {
    screen: `loop ${file}`,
    size: "1440x900",
    repro: loopRepro(file),
  }
  try {
    for (const [at, step] of LOOP_STEPS.entries()) {
      try {
        await step.run(driver, memo)
      } catch (error) {
        return {
          ...base,
          ok: false,
          problem: `core loop step ${at + 1} "${step.name}" failed: ${error.message.split("\n")[0]}`,
          shot: await driver.screenshot(`loop-${file}-step-${at + 1}`),
          ms: world.now() - started,
        }
      }
    }
    return { ...base, ok: true, ms: world.now() - started }
  } finally {
    await driver.close()
  }
}
