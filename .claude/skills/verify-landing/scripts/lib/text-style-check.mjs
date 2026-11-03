import { srgbToOklch } from "../../../verify-app-ui/scripts/lib/oklch.mjs"
import { FILES } from "./assumes.mjs"
import { readDesignFile } from "./spec.mjs"
import { verdict } from "./verdict.mjs"

const TEXT_STYLE_EXCEPTIONS = [
  {
    section: "Statement",
    text: "opencv helps",
    property: "color",
    reason:
      "Pen l-faint #A0A0A9 is about 2.5:1. The statement uses the lightest foreground mix that measures at least 3:1.",
    until: "2027-01-31",
    approvedBy: "pending operator (quanvu309)",
  },
  {
    section: "Statement",
    text: "you show it: a CV and letter written for each role, a board for every application, and a coach that knows both.",
    property: "color",
    reason:
      "Same contrast floor as the other faint run in the statement. Pen l-faint fails 3:1 at this size.",
    until: "2027-01-31",
    approvedBy: "pending operator (quanvu309)",
  },
  {
    section: "Logos",
    text: "PEOPLE USING OPENCV HAVE INTERVIEWED AT",
    property: "color",
    reason:
      "Pen l-faint fails 4.5:1 at 12px. The kicker keeps muted-foreground, matched to l-muted.",
    until: "2027-01-31",
    approvedBy: "pending operator (quanvu309)",
  },
  {
    section: "Footer Wrap",
    text: "© 2026 opencv",
    property: "color",
    reason:
      "Pen l-faint fails 4.5:1 at 13px. The copyright line keeps muted-foreground.",
    until: "2027-01-31",
    approvedBy: "pending operator (quanvu309)",
  },
]

function normPen(value) {
  return value
    .replaceAll("\u2018", "\u2019")
    .replaceAll("'", "\u2019")
    .replaceAll(/\s+/g, " ")
    .trim()
}

function isWordChar(char) {
  return char !== "" && /[\p{L}\p{N}]/u.test(char)
}

function boundedIncludes(haystack, needle) {
  if (needle === "") return false
  let from = 0
  while (from <= haystack.length - needle.length) {
    const at = haystack.indexOf(needle, from)
    if (at < 0) return false
    const before = at > 0 ? haystack[at - 1] : ""
    const after =
      at + needle.length < haystack.length ? haystack[at + needle.length] : ""
    const left = !isWordChar(needle[0] ?? "") || !isWordChar(before)
    const right =
      !isWordChar(needle[needle.length - 1] ?? "") || !isWordChar(after)
    if (left && right) return true
    from = at + 1
  }
  return false
}

function findMeasured(candidates, want) {
  const exact = candidates.filter((item) => item.text === want)
  const pool = exact.length
    ? exact
    : candidates.filter((item) => boundedIncludes(item.text, want))
  if (pool.length === 0) return null
  pool.sort(
    (a, b) =>
      a.text.length - b.text.length ||
      (a.runs?.length ?? 1) - (b.runs?.length ?? 1)
  )
  const bestLength = pool[0].text.length
  const bestRuns = pool[0].runs?.length ?? 1
  const tight = pool.filter(
    (item) =>
      item.text.length === bestLength && (item.runs?.length ?? 1) === bestRuns
  )
  return tight[tight.length - 1]
}

function weightValue(value) {
  const text = String(value).trim().toLowerCase()
  if (text === "normal") return "400"
  if (text === "bold") return "700"
  const parsed = Number.parseInt(text, 10)
  return Number.isNaN(parsed) ? text : String(parsed)
}

function clip(text) {
  return text.length > 48 ? `${text.slice(0, 48)}…` : text
}

const PRINTED_FAILURE_LIMIT = 2

const PRINT_FIRST_MARKERS = ["[Statement] mark", "#59595B"]

export function rankFailuresForPrint(failures) {
  const rank = (line) => {
    const index = PRINT_FIRST_MARKERS.findIndex((marker) =>
      line.includes(marker)
    )
    return index === -1 ? PRINT_FIRST_MARKERS.length : index
  }
  return [...failures].sort((a, b) => rank(a) - rank(b))
}

export function unexcusedFailures(mismatches, exceptions, today) {
  const covered = new Set()
  const failures = []
  for (const mismatch of mismatches) {
    const exception = exceptions.find(
      (entry) =>
        entry.section === mismatch.section &&
        entry.text === mismatch.text &&
        entry.property === mismatch.property &&
        entry.until >= today
    )
    if (exception) {
      covered.add(exception)
      continue
    }
    failures.push(mismatch.line)
  }
  for (const entry of exceptions) {
    if (covered.has(entry)) continue
    failures.push(
      `[${entry.section}] "${clip(entry.text)}" ${entry.property} exception is stale`
    )
  }
  return failures
}

function textStartsLine(found, want) {
  const at = found.text.indexOf(want)
  if (at < 0) return false
  return Array.isArray(found.lineStarts) && found.lineStarts.includes(at)
}

function rgbHex(color) {
  return `#${color
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`
}

function hexRgb(fill) {
  const match = /^#([0-9a-fA-F]{6})$/.exec(fill ?? "")
  if (!match) return null
  return [0, 2, 4].map((index) =>
    Number.parseInt(match[1].slice(index, index + 2), 16)
  )
}

export function textStyleVerdict(penSections) {
  const rule =
    "At 1440 each landing text matches the fields opencv.pen sets (OKLCH colour within 0.02 lightness and 0.02 chroma, size within 0.5px, line-height ratio within 0.03, weight exact, tracking within 0.15px) and each inline mark has an svg or img within 2px. A pen text with startsLine fails when that text does not start a line. The line-start check runs at 1440 only. A pen text missing from its section fails unless design/landing.omitted.json omits it. Match opencv.pen or add a dated exception."
  let styles
  let omittedRows
  try {
    styles = JSON.parse(readDesignFile(FILES.styles, "utf8"))
    omittedRows = JSON.parse(readDesignFile(FILES.omitted, "utf8"))
  } catch (error) {
    return verdict(
      "31",
      "text-style-matches-pen",
      rule,
      false,
      `styles file unreadable: ${error.message}`
    )
  }
  if (!Array.isArray(omittedRows)) {
    return verdict(
      "31",
      "text-style-matches-pen",
      rule,
      false,
      "omissions file is not a list"
    )
  }
  const omittedTexts = new Set(omittedRows.map((entry) => entry.text))
  const today = new Date().toISOString().slice(0, 10)
  const mismatches = []
  let compared = 0
  let markCount = 0
  for (const section of styles.sections ?? []) {
    const live = penSections?.[section.name]
    const candidates = live?.texts ?? []
    for (const spec of section.texts ?? []) {
      const want = normPen(spec.content)
      const found = live ? findMeasured(candidates, want) : null
      if (!found) {
        if (omittedTexts.has(spec.content)) continue
        mismatches.push({
          section: section.name,
          text: spec.content,
          property: "presence",
          line: `[${section.name}] "${clip(spec.content)}" text measured missing pen present`,
        })
        continue
      }
      compared += 1
      if (spec.startsLine === true && !textStartsLine(found, want)) {
        mismatches.push({
          section: section.name,
          text: spec.content,
          property: "lineStart",
          line: `[${section.name}] "${clip(spec.content)}" lineStart measured mid-line pen starts a line`,
        })
      }
      const seen = new Set()
      const runs = found.runs?.length ? found.runs : [found]
      for (const run of runs) {
        const problems = []
        if (typeof spec.fill === "string") {
          const penRgb = hexRgb(spec.fill)
          const measured = srgbToOklch(...run.color)
          const pen = penRgb ? srgbToOklch(...penRgb) : null
          const close =
            pen &&
            Math.abs(measured.L - pen.L) <= 0.02 &&
            Math.abs(measured.C - pen.C) <= 0.02
          if (!close) {
            problems.push({
              property: "color",
              measured: rgbHex(run.color),
              pen: spec.fill,
            })
          }
        }
        if (typeof spec.fontSize === "number") {
          if (Math.abs(run.fontSize - spec.fontSize) > 0.5) {
            problems.push({
              property: "fontSize",
              measured: `${run.fontSize}px`,
              pen: `${spec.fontSize}px`,
            })
          }
        }
        if (typeof spec.lineHeight === "number") {
          const bad =
            run.lineHeight === "normal" ||
            Math.abs(run.lineHeight - spec.lineHeight) > 0.03
          if (bad) {
            problems.push({
              property: "lineHeight",
              measured: String(run.lineHeight),
              pen: String(spec.lineHeight),
            })
          }
        }
        if (spec.fontWeight != null) {
          if (weightValue(run.fontWeight) !== weightValue(spec.fontWeight)) {
            problems.push({
              property: "fontWeight",
              measured: String(run.fontWeight),
              pen: String(spec.fontWeight),
            })
          }
        }
        if (typeof spec.letterSpacing === "number") {
          if (Math.abs(run.letterSpacing - spec.letterSpacing) > 0.15) {
            problems.push({
              property: "letterSpacing",
              measured: `${run.letterSpacing}px`,
              pen: `${spec.letterSpacing}px`,
            })
          }
        }
        for (const problem of problems) {
          const line = `[${section.name}] "${clip(spec.content)}" ${problem.property} measured ${problem.measured} pen ${problem.pen}`
          if (seen.has(line)) continue
          seen.add(line)
          mismatches.push({
            section: section.name,
            text: spec.content,
            property: problem.property,
            line,
          })
        }
      }
    }
    for (const mark of section.marks ?? []) {
      markCount += 1
      const boxes = live?.marks ?? []
      const hit = boxes.find(
        (box) =>
          Math.abs(box.w - mark.width) <= 2 &&
          Math.abs(box.h - mark.height) <= 2
      )
      if (hit) {
        const index = boxes.indexOf(hit)
        boxes.splice(index, 1)
        continue
      }
      const nearest = boxes
        .map((box) => `${box.tag} ${box.w.toFixed(0)}x${box.h.toFixed(0)}`)
        .slice(0, 3)
        .join(", ")
      mismatches.push({
        section: section.name,
        text: mark.name || "mark",
        property: "size",
        line: `[${section.name}] mark size measured ${nearest || "none"} pen ${mark.width}x${mark.height}`,
      })
    }
  }
  const failures = unexcusedFailures(mismatches, TEXT_STYLE_EXCEPTIONS, today)
  const printed = rankFailuresForPrint(failures)
  const lead = printed.slice(0, PRINTED_FAILURE_LIMIT).join("; ")
  const more =
    failures.length > PRINTED_FAILURE_LIMIT
      ? `; +${failures.length - PRINTED_FAILURE_LIMIT} more`
      : ""
  const measured = failures.length
    ? `${lead}${more}; match opencv.pen or add a dated exception`
    : `${compared} texts, ${markCount} marks, ${TEXT_STYLE_EXCEPTIONS.length} dated exceptions`
  return verdict(
    "31",
    "text-style-matches-pen",
    rule,
    failures.length === 0,
    measured
  )
}

const drift = {
  section: "Statement",
  text: "One link",
  property: "color",
  line: '[Statement] "One link" color #FFFFFF pen #111111',
}
const exception = { ...drift, until: "2026-12-01" }
export const badFixture = [
  {
    name: "a mismatch with no exception",
    fails: () => unexcusedFailures([drift], [], "2026-11-03").length > 0,
  },
  {
    name: "an exception past its date",
    fails: () =>
      unexcusedFailures([drift], [exception], "2027-01-01").length > 0,
  },
  {
    name: "an exception for a property that now matches",
    fails: () => unexcusedFailures([], [exception], "2026-11-03").length > 0,
  },
]
