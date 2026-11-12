import { SIDES } from "./before-after.mjs"

export const SECTION_HEADING = "## Before / after"
export const TABLE_HEAD = "| main | this PR |"
const LINK = /^!\[([^\]]*)\]\((\S+)\)$/

export function linksFromShot(lines) {
  return lines
    .map((line) => LINK.exec(line.trim()))
    .filter(Boolean)
    .map((match) => ({ alt: match[1], url: match[2] }))
}

export function picturesToUpload(manifest, annotated) {
  const pictures = [annotated]
    .flat()
    .map((file) => ({ role: "annotated", file }))
  for (const capture of manifest.captures)
    for (const side of SIDES)
      if (capture[side]?.file)
        pictures.push({
          role: side,
          screen: capture.screen,
          width: capture.width,
          file: capture[side].file,
        })
  return pictures
}

export function attachUrls(pictures, links) {
  if (pictures.length !== links.length)
    throw new Error(
      `uploaded ${pictures.length} pictures but shot printed ${links.length} links`
    )
  return pictures.map((picture, at) => ({ ...picture, url: links[at].url }))
}

const cell = (capture, side, url) => {
  if (url)
    return `![${capture.screen} ${capture.width} ${side === "before" ? "main" : "this PR"}](${url})`
  return `not captured: ${capture[side]?.error ?? "missing"}`
}

export function renderPrSection({ manifest, uploaded, checks = [] }) {
  const composites = uploaded.filter((picture) => picture.role === "annotated")
  const urlOf = (role, screen, width) =>
    uploaded.find(
      (picture) =>
        picture.role === role &&
        (role === "annotated" ||
          (picture.screen === screen && picture.width === width))
    )?.url
  const sizes = [
    ...new Set(
      manifest.captures.map(
        (capture) => `${capture.viewport.width} by ${capture.viewport.height}`
      )
    ),
  ]
  const lines = [
    SECTION_HEADING,
    "",
    ...composites.flatMap((picture) => [
      `![${compositeAlt(picture.file, composites.length)}](${picture.url})`,
      "",
    ]),
    `Full screenshots. Linux renders at ${sizes.join(" and ")}, same steps and fake Coach on both sides; main is ${manifest.baseSha.slice(0, 8)}.`,
    "",
    TABLE_HEAD,
    "| --- | --- |",
    ...manifest.captures.map(
      (capture) =>
        `| ${cell(capture, "before", urlOf("before", capture.screen, capture.width))} | ${cell(capture, "after", urlOf("after", capture.screen, capture.width))} |`
    ),
  ]
  const againstMain = checks.some((check) => check.newFailed !== undefined)
  if (checks.length)
    lines.push(
      "",
      "`node scripts/ui.mjs check` on this PR:",
      "",
      againstMain
        ? "| screen | compared | failed | new since main |"
        : "| screen | compared | failed |",
      againstMain ? "| --- | --- | --- | --- |" : "| --- | --- | --- |",
      ...checks.map((check) => {
        if (check.error)
          return `| ${check.screen} | ${check.error} | |${againstMain ? " |" : ""}`
        const row = `| ${check.screen} | ${check.compared} | ${check.failed} |`
        return againstMain ? `${row} ${check.newFailed ?? "-"} |` : row
      })
    )
  return lines.join("\n")
}

function compositeAlt(file, count) {
  if (count === 1) return "Annotated before and after"
  const name = String(file)
    .split("/")
    .at(-1)
    .replace(/\.png$/i, "")
    .replaceAll("-", " ")
  return `Annotated before and after: ${name}`
}

export function checkSummary(screen, result) {
  const last = [...result.lines]
    .reverse()
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .find((value) => value && value.screen === screen && "compared" in value)
  if (last)
    return {
      screen,
      compared: last.compared,
      failed: last.failed,
      ...(last.newFailed === undefined ? {} : { newFailed: last.newFailed }),
    }
  return { screen, error: result.lines.at(-1) ?? "no result" }
}
