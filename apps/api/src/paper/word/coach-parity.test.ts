import { describe, expect, it } from "vitest"

import { PaperPackage } from "../package-engine.js"
import { PaperPackageRefusal } from "../package-errors.js"
import { cvPackage, paragraph, run } from "../package-fixtures.js"
import { plannedReplacements } from "../package-planner.js"
import { readPackageZip } from "../package-zip.js"
import { projectParagraphs } from "./classify.js"
import { mutateWord } from "./mutate.js"

const context = {
  docId: "cv",
  incarnation: "import-one",
  revision: "revision-one",
}

const bold = "<w:b/>"
const numbered =
  '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>'

const corpus: Record<string, string> = {
  plain: paragraph("alpha"),
  repeated: paragraph("same") + paragraph("same"),
  accented: paragraph("é café naïve"),
  padded: `<w:p>${run(" padded words ")}</w:p>`,
  entities:
    "<w:p><w:r><w:t>Tom &amp; Jerry&#8217;s plan &lt;now&gt;</w:t></w:r></w:p>",
  astral: paragraph("Shipped 🚀 launch"),
  splitRuns: `<w:p>${run("Hello ")}${run("world")}</w:p>`,
  rsidRuns:
    '<w:p w:rsidR="00A1B2C3"><w:r w:rsidR="00B2"><w:t xml:space="preserve">Managed </w:t></w:r><w:r w:rsidR="00C3"><w:t>budgets</w:t></w:r></w:p>',
  mixed: `<w:p>${run("Led the ")}${run("data", bold)}${run(" team")}</w:p>`,
  threeFormats: `<w:p>${run("Plain")}${run(" bold", bold)}${run(" italic", "<w:i/>")}</w:p>`,
  boundary: `<w:p>${run("Led ")}${run("data", bold)}</w:p>`,
  sameLetterBoundary: `<w:p>${run("Led d")}${run("data", bold)}</w:p>`,
  versioned: `<w:p w14:paraId="1A2B3C4D" w14:textId="0ABCDEF1">${run("versioned line")}</w:p>`,
  bullet: `<w:p>${numbered}${run("Grew revenue by 20%")}</w:p>`,
  boldLeadBullet: `<w:p>${numbered}${run("Lead: ", bold)}${run("ran the platform team")}</w:p>`,
  link: `<w:p>${run("Portfolio at ")}<w:hyperlink r:id="link">${run("example site")}</w:hyperlink>${run(" today")}</w:p>`,
  linkedBullet: `<w:p>${numbered}${run("See ")}<w:hyperlink r:id="link">${run("my work")}</w:hyperlink></w:p>`,
  lineBreak: `<w:p>${run("line one")}<w:r><w:br/></w:r>${run("line two")}</w:p>`,
  proofed: `<w:p><w:proofErr w:type="spellStart"/>${run("Teh")}<w:proofErr w:type="spellEnd"/>${run(" plan")}</w:p>`,
  crossProofing: `<w:p>${run("start ")}<w:proofErr w:type="gramStart"/>${run("crosses")}</w:p><w:p>${run("ends")}<w:proofErr w:type="gramEnd"/>${run(" here")}</w:p>`,
  tableCell: `<w:tbl><w:tr><w:tc><w:tcPr/>${paragraph("Python, SQL")}</w:tc><w:tc>${paragraph("Go")}</w:tc></w:tr></w:tbl>`,
  tableCellRuns: `<w:tbl><w:tr><w:tc>${`<w:p>${run("Skills: ", bold)}${run("TypeScript")}</w:p>`}</w:tc></w:tr></w:tbl>`,
}

type Replacement = { targetId: string; before: string; after: string }
type Region = ReturnType<PaperPackage["read"]>["regions"][number]
type Editable = Extract<Region, { kind: "editable" }>

function firstWord(text: string) {
  const word = text.split(" ").find((part) => part.length > 0) ?? text
  return text.indexOf(word) === text.lastIndexOf(word) ? word : text
}

function replacements(regions: readonly Region[]): Replacement[] {
  const out: Replacement[] = []
  regions.forEach((region, index) => {
    if (region.kind !== "editable") return
    const text = region.text
    const targetId = region.targetId
    out.push(
      { targetId, before: firstWord(text), after: "Fresh" },
      { targetId, before: text, after: `${text} more` },
      { targetId, before: text, after: `New ${text}` },
      { targetId, before: text, after: "" }
    )
    const group: Editable[] = [region]
    for (const next of regions.slice(index + 1)) {
      if (
        next.kind !== "editable" ||
        next.location.paragraph !== region.location.paragraph
      )
        break
      group.push(next)
    }
    if (group.length < 2) return
    const joined = group.map((item) => item.text).join("")
    for (const after of [
      `${joined}!`,
      `Start ${joined}`,
      "Rewritten line",
      joined.slice(0, 2) + "X" + joined.slice(3),
    ])
      out.push({ targetId, before: joined, after })
  })
  return out
}

function codeOf(error: unknown) {
  if (error instanceof PaperPackageRefusal) return error.code
  if (error instanceof Error) return error.message
  return String(error)
}

async function members(bytes: Uint8Array) {
  const archive = await readPackageZip(Buffer.from(bytes))
  return new Map(
    [...archive.files].map(([name, value]) => [
      name,
      name === "word/document.xml"
        ? value
            .toString("utf8")
            .replace(/w14:textId="[0-9A-Fa-f]{8}"/g, 'w14:textId="?"')
        : value.toString("base64"),
    ])
  )
}

async function oldWriter(opened: PaperPackage, edit: Replacement) {
  try {
    const prepared = await opened.prepare({
      docId: context.docId,
      basedOn: context.revision,
      edits: [{ op: "replaceText", ...edit }],
    })
    if (prepared.changes.length === 0) return { kind: "unchanged" as const }
    return {
      kind: "written" as const,
      bytes: new Uint8Array(prepared.package.export()),
    }
  } catch (error) {
    return { kind: "refused" as const, code: codeOf(error) }
  }
}

async function module(
  bytes: Uint8Array,
  opened: PaperPackage,
  edit: Replacement
) {
  const keys = opened.sidecar().paragraphs.map((row) => row.key)
  const paragraphs = projectParagraphs(bytes, keys)
  if (!paragraphs) return { kind: "refused" as const, code: "PROJECTION" }
  try {
    const planned = plannedReplacements(opened.read(), paragraphs, keys, [
      { op: "replaceText", ...edit },
    ])
    const drafted = mutateWord(
      bytes,
      {
        version: 2,
        paragraphs: opened.sidecar().paragraphs.map((row) => ({
          key: row.key,
          ordinal: row.ordinal,
          textIds: [...row.textIds],
        })),
      },
      planned.ops,
      planned.spans
    )
    if (drafted.refused)
      return { kind: "refused" as const, code: drafted.code ?? drafted.reason }
    return { kind: "written" as const, bytes: drafted.bytes }
  } catch (error) {
    return { kind: "refused" as const, code: codeOf(error) }
  }
}

describe("the Word module writes every Coach replacement the old writer wrote", () => {
  it("matches the old writer byte for byte on the fixture corpus, except a listed formatting hold", async () => {
    const accepted: string[] = []
    const held: string[] = []
    const mismatched: string[] = []
    let targets = 0
    for (const [name, body] of Object.entries(corpus)) {
      const bytes = cvPackage(body)
      const opened = await PaperPackage.open(bytes, context)
      const regions = opened.read().regions
      targets += regions.filter((region) => region.kind === "editable").length
      for (const edit of replacements(regions)) {
        const label = `${name}: ${JSON.stringify(edit.before)} -> ${JSON.stringify(edit.after)}`
        const before = await oldWriter(opened, edit)
        if (before.kind !== "written") continue
        const after = await module(bytes, opened, edit)
        if (after.kind === "refused") {
          if (after.code === "MIXED_FORMAT") held.push(label)
          else mismatched.push(`${label} refused ${after.code}`)
          continue
        }
        const left = await members(before.bytes)
        const right = await members(after.bytes)
        const differing = [
          ...new Set([...left.keys(), ...right.keys()]),
        ].filter((member) => left.get(member) !== right.get(member))
        if (differing.length > 0)
          mismatched.push(`${label} differs in ${differing.join(", ")}`)
        else accepted.push(label)
      }
    }
    expect(mismatched).toEqual([])
    expect(
      held.every((label) =>
        /mixed|threeFormats|boldLead|tableCellRuns/.test(label)
      )
    ).toBe(true)
    expect(targets).toBeGreaterThan(30)
    expect(accepted.length).toBeGreaterThan(100)
    for (const name of [
      "bullet",
      "boldLeadBullet",
      "link",
      "linkedBullet",
      "lineBreak",
      "proofed",
      "tableCell",
      "tableCellRuns",
      "rsidRuns",
      "entities",
      "versioned",
    ])
      expect(accepted.some((label) => label.startsWith(`${name}:`))).toBe(true)
  })
})
