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
  const pictures = [{ role: "annotated", file: annotated }]
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
    `![Annotated before and after](${urlOf("annotated")})`,
    "",
    `Full screenshots. Linux renders at ${sizes.join(" and ")}, same steps and fake Coach on both sides; main is ${manifest.baseSha.slice(0, 8)}.`,
    "",
    TABLE_HEAD,
    "| --- | --- |",
    ...manifest.captures.map(
      (capture) =>
        `| ${cell(capture, "before", urlOf("before", capture.screen, capture.width))} | ${cell(capture, "after", urlOf("after", capture.screen, capture.width))} |`
    ),
  ]
  if (checks.length)
    lines.push(
      "",
      "`node scripts/ui.mjs check` on this PR:",
      "",
      "| screen | compared | failed |",
      "| --- | --- | --- |",
      ...checks.map((check) =>
        check.error
          ? `| ${check.screen} | ${check.error} | |`
          : `| ${check.screen} | ${check.compared} | ${check.failed} |`
      )
    )
  return lines.join("\n")
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
  if (last) return { screen, compared: last.compared, failed: last.failed }
  return { screen, error: result.lines.at(-1) ?? "no result" }
}
