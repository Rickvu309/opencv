export const WEB_HTML =
  '<h1>Ada Nguyen</h1><h2>Experience</h2><ul><li>Led the team</li><li>Shipped the app</li></ul><p>Portfolio <a href="https://example.com/ada">site</a></p>'

export const DOCS_HTML =
  '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-walk"><h1 dir="ltr"><span style="font-size:20pt;">Ada Nguyen</span></h1><h2 dir="ltr"><span style="font-size:16pt;">Experience</span></h2><ul style="margin-top:0;margin-bottom:0;"><li dir="ltr" style="list-style-type:disc;"><p dir="ltr" role="presentation"><span>Led the team</span></p></li><li dir="ltr" style="list-style-type:disc;"><p dir="ltr" role="presentation"><span>Shipped the app</span></p></li></ul><p dir="ltr"><span>Portfolio </span><a href="https://example.com/ada"><span style="text-decoration:underline;">site</span></a></p></b>'

export const WORD_HTML =
  '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><body lang=EN-US><!--StartFragment--><h1><span lang=EN-US>Ada Nguyen</span></h1><h2><span lang=EN-US>Experience</span></h2><ul style="margin-top:0in" type=disc><li class=MsoNormal style="mso-list:l0 level1 lfo1"><span lang=EN-US>Led the team</span></li><li class=MsoNormal style="mso-list:l0 level1 lfo1"><span lang=EN-US>Shipped the app</span></li></ul><p class=MsoNormal><span lang=EN-US>Portfolio <a href="https://example.com/ada">site</a></span></p><!--EndFragment--></body></html>'

export const PLAIN_LINES = "Line one\nLine two\nLine three"
export const A4_TWIPS = { width: 11906, height: 16838 }
const TWIP_SLACK = 20
const SYNC_MS = 10_000

const texts = (blocks) => blocks.map((block) => block.text)
const nonEmpty = (blocks) => blocks.filter((block) => block.text.trim())
const named = (blocks, text) => blocks.find((block) => block.text === text)
const shown = (blocks) =>
  JSON.stringify(nonEmpty(blocks).map((block) => block.text)).slice(0, 160)

const keepsBothLines = (blocks) => {
  const all = texts(blocks)
  if (!all.includes("Alpha"))
    return `the first line is gone; the page holds ${shown(blocks)}`
  if (!all.includes("BetaZ"))
    return `the key did not land after the last line; the page holds ${shown(blocks)}`
  return null
}

const isList = (block) =>
  block?.type === "bulletListItem" || block?.type === "numberedListItem"

const keepsRichStructure = (blocks) => {
  const lost = []
  if (
    named(blocks, "Ada Nguyen")?.type !== "heading" ||
    named(blocks, "Ada Nguyen")?.level !== 1
  )
    lost.push("heading 1")
  if (
    named(blocks, "Experience")?.type !== "heading" ||
    named(blocks, "Experience")?.level !== 2
  )
    lost.push("heading 2")
  if (
    !isList(named(blocks, "Led the team")) ||
    !isList(named(blocks, "Shipped the app"))
  )
    lost.push("list")
  if (!blocks.some((block) => block.links.includes("https://example.com/ada")))
    lost.push("link")
  return lost.length
    ? `the paste lost ${lost.join(", ")}; the page holds ${shown(blocks)}`
    : null
}

const pastedRich = (html) => async (person) => {
  await person.openBlankCv()
  await person.paste({
    html,
    text: "Ada Nguyen\nExperience\nLed the team\nShipped the app\nPortfolio site",
  })
  return { blocks: await person.blocks() }
}

const typedLines = async (person, lines) => {
  for (const [at, line] of lines.entries()) {
    if (at > 0) await person.press("Enter")
    await person.type(line)
  }
}

const listStarted = async (person) => {
  await person.openBlankCv()
  await person.press("Control+Shift+8")
}

export const ROWS = [
  {
    id: "select-all-end-type",
    area: "Selection",
    does: "After clearing the page, Ctrl+A, End, Enter and typing adds a line after the last one",
    act: async (person) => {
      await person.openBlankCv()
      await person.chord(["Control+a", "Delete"])
      await typedLines(person, ["Alpha", "Beta"])
      await person.chord(["Control+a", "End", "Enter"])
      await person.type("Gamma")
      return { blocks: await person.blocks() }
    },
    pass: ({ blocks }) => {
      const lost = ["Alpha", "Beta", "Gamma"].filter(
        (line) => !texts(blocks).includes(line)
      )
      return lost.length
        ? `lost ${lost.join(", ")}; the page holds ${shown(blocks)}`
        : null
    },
  },
  {
    id: "select-all-arrow-right-type",
    area: "Selection",
    does: "After clearing the page, Ctrl+A, ArrowRight, then a key adds the key after the last line",
    act: async (person) => {
      await person.openBlankCv()
      await person.chord(["Control+a", "Delete"])
      await typedLines(person, ["Alpha", "Beta"])
      await person.chord(["Control+a", "ArrowRight"])
      await person.type("Z")
      return { blocks: await person.blocks() }
    },
    pass: ({ blocks }) => keepsBothLines(blocks),
  },
  {
    id: "list-enter-continues",
    area: "Lists",
    does: "Enter in a bullet makes the next bullet",
    act: async (person) => {
      await listStarted(person)
      await typedLines(person, ["One", "Two"])
      return { blocks: await person.blocks() }
    },
    pass: ({ blocks }) =>
      isList(named(blocks, "One")) && isList(named(blocks, "Two"))
        ? null
        : `the second line is ${named(blocks, "Two")?.type ?? "missing"}, not a bullet`,
  },
  {
    id: "list-tab-nests",
    area: "Lists",
    does: "Tab on a new bullet nests it under the one above",
    act: async (person) => {
      await listStarted(person)
      await person.type("One")
      await person.press("Enter")
      await person.press("Tab")
      await person.type("Nested")
      return { blocks: await person.blocks() }
    },
    pass: ({ blocks }) => {
      const parent = named(blocks, "One")
      const child = named(blocks, "Nested")
      if (!isList(child))
        return `the nested line is ${child?.type ?? "missing"}, not a bullet`
      return child.depth > (parent?.depth ?? 0)
        ? null
        : `the nested line sits at depth ${child.depth}, the same as its parent`
    },
  },
  {
    id: "list-empty-enter-ends",
    area: "Lists",
    does: "Enter on an empty bullet ends the list",
    act: async (person) => {
      await listStarted(person)
      await typedLines(person, ["One", "Two"])
      await person.press("Enter")
      await person.press("Enter")
      await person.type("After")
      return { blocks: await person.blocks() }
    },
    pass: ({ blocks }) => {
      if (!isList(named(blocks, "One")) || !isList(named(blocks, "Two")))
        return `the list did not hold two bullets; the page holds ${shown(blocks)}`
      if (named(blocks, "After")?.type !== "paragraph")
        return `the line after the list is ${named(blocks, "After")?.type ?? "missing"}, not a paragraph`
      return blocks.some((block) => isList(block) && !block.text.trim())
        ? "an empty bullet stayed behind"
        : null
    },
  },
  {
    id: "paste-rich-word",
    area: "Paste",
    does: "Pasting Word HTML keeps headings, the list and the link",
    act: pastedRich(WORD_HTML),
    pass: ({ blocks }) => keepsRichStructure(blocks),
  },
  {
    id: "paste-rich-docs",
    area: "Paste",
    does: "Pasting Google Docs HTML keeps headings, the list and the link",
    act: pastedRich(DOCS_HTML),
    pass: ({ blocks }) => keepsRichStructure(blocks),
  },
  {
    id: "paste-rich-web",
    area: "Paste",
    does: "Pasting web page HTML keeps headings, the list and the link",
    act: pastedRich(WEB_HTML),
    pass: ({ blocks }) => keepsRichStructure(blocks),
  },
  {
    id: "paste-plain-lines",
    area: "Paste",
    does: "Pasting three plain lines makes three paragraphs",
    act: async (person) => {
      await person.openBlankCv()
      await person.paste({ text: PLAIN_LINES })
      return { blocks: await person.blocks() }
    },
    pass: ({ blocks }) =>
      ["Line one", "Line two", "Line three"].every(
        (line) => named(blocks, line)?.type === "paragraph"
      )
        ? null
        : `the lines are not three paragraphs; the page holds ${shown(blocks)}`,
  },
  {
    id: "bold-three-paragraphs",
    area: "Marks",
    does: "Ctrl+A then Ctrl+B bolds all three paragraphs",
    act: async (person) => {
      await person.openBlankCv()
      await typedLines(person, ["First", "Second", "Third"])
      await person.press("Control+a")
      await person.press("Control+b")
      return { blocks: await person.blocks() }
    },
    pass: ({ blocks }) => {
      const plain = ["First", "Second", "Third"].filter(
        (line) => !named(blocks, line)?.bold
      )
      return plain.length ? `not bold: ${plain.join(", ")}` : null
    },
  },
  {
    id: "undo-after-paste",
    area: "Undo",
    does: "One Ctrl+Z after a paste removes only the paste",
    act: async (person) => {
      await person.openBlankCv()
      await person.type("Typed first.")
      await person.paste({ text: " Pasted words" })
      await person.press("Control+z")
      return { blocks: await person.blocks() }
    },
    pass: ({ blocks }) => {
      const all = texts(blocks).join("\n")
      if (all.includes("Pasted words")) return "the paste is still there"
      return all.includes("Typed first.")
        ? null
        : `the typing before the paste went too; the page holds ${shown(blocks)}`
    },
  },
  {
    id: "pdf-download",
    area: "Export",
    does: "File offers a PDF download that is a PDF",
    act: async (person) => {
      await person.openBlankCv()
      await person.type("PDF line")
      return await person.downloadPdf()
    },
    pass: ({ offered, isPdf }) => {
      if (!offered) return "the File menu offers no PDF download"
      return isPdf ? null : "the downloaded file is not a PDF"
    },
  },
  {
    id: "print-only-page",
    area: "Export",
    does: "Printing shows only the page, not the app around it",
    act: async (person) => {
      await person.openBlankCv()
      await person.type("Printed line")
      return await person.printView()
    },
    pass: ({ chrome }) =>
      chrome.length
        ? `print still shows ${chrome.slice(0, 4).join(", ")}`
        : null,
  },
  {
    id: "page-default-a4",
    area: "Page setup",
    does: "A new CV is A4 in the Word download",
    act: async (person) => {
      await person.openBlankCv()
      await person.type("A4 line")
      return await person.downloadWord()
    },
    pass: ({ page }) =>
      Math.abs(page.width - A4_TWIPS.width) <= TWIP_SLACK &&
      Math.abs(page.height - A4_TWIPS.height) <= TWIP_SLACK
        ? null
        : `the page is ${page.width}x${page.height} twips, not A4 ${A4_TWIPS.width}x${A4_TWIPS.height}`,
  },
  {
    id: "word-keeps-headings-links",
    area: "Export",
    does: "A Word CV with Title, Heading 1 and 2 and a link comes back with all of them",
    act: async (person) => {
      await person.openImportedCv("cv-formatted.docx")
      return await person.downloadWord()
    },
    pass: ({ headings, hyperlinks }) => {
      const lost = []
      if (!headings.includes("Heading1")) lost.push("Heading1")
      if (!headings.includes("Heading2")) lost.push("Heading2")
      if (hyperlinks < 1) lost.push("the link")
      return lost.length
        ? `the Word file lost ${lost.join(", ")}; its heading styles are ${JSON.stringify(headings)}`
        : null
    },
  },
  {
    id: "phone-caret-type",
    area: "Phone",
    does: "At 390 wide a tap puts the caret on the page and typing lands",
    act: async (person) => {
      await person.openBlankCv()
      return await person.onPhone(async (phone) => {
        await phone.tapPage()
        const caret = await phone.caretInPage()
        await phone.type("Phone words")
        return { caret, blocks: await phone.blocks() }
      })
    },
    pass: ({ caret, blocks }) => {
      if (!caret) return "the tap left no caret on the page"
      return texts(blocks).some((text) => text.includes("Phone words"))
        ? null
        : `typing did not land; the page holds ${shown(blocks)}`
    },
  },
  {
    id: "two-tabs",
    area: "Save",
    does: "Two tabs on one CV both show what each typed",
    act: async (person) => {
      await person.openBlankCv()
      return await person.inTwoTabs(async (first, second) => {
        await first.type("Tab one words")
        await second.typeAtEnd(" tab two words")
        await first.waitForText("tab two words", SYNC_MS)
        await second.waitForText("Tab one words", SYNC_MS)
        return {
          first: texts(await first.blocks()),
          second: texts(await second.blocks()),
        }
      })
    },
    pass: ({ first, second }) => {
      const both = (lines) => {
        const all = lines.join("\n")
        return all.includes("Tab one words") && all.includes("tab two words")
      }
      if (!both(first))
        return "the first tab does not show the second tab's words"
      return both(second)
        ? null
        : "the second tab does not show the first tab's words"
    },
  },
  {
    id: "reload-keeps-text",
    area: "Save",
    does: "Typed text is still there after a reload",
    act: async (person) => {
      await person.openBlankCv()
      await person.type("Kept after reload")
      await person.waitSaved()
      await person.reload()
      return { blocks: await person.blocks() }
    },
    pass: ({ blocks }) =>
      texts(blocks).some((text) => text.includes("Kept after reload"))
        ? null
        : `the text is gone after reload; the page holds ${shown(blocks)}`,
  },
]
