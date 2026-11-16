const CLIP = /^(?:overflow|overflow-y)-(?:hidden|clip)$/
const SCROLL = /^(?:overflow|overflow-y)-(?:auto|scroll)$/

function tokens(className) {
  return className.split(/\s+/).filter(Boolean)
}

function lastBlockOverflow(className) {
  return tokens(className)
    .filter((token) => CLIP.test(token) || SCROLL.test(token))
    .at(-1)
}

function classOn(text, marker) {
  const at = text.indexOf(marker)
  if (at < 0) return ""
  const start = text.lastIndexOf("<", at)
  const end = text.indexOf(">", at)
  if (start < 0 || end < 0) return ""
  return /className="([^"]*)"/.exec(text.slice(start, end + 1))?.[1] ?? ""
}

export function detect(text, path = "") {
  if (!String(path).endsWith("rich-page.tsx")) return []
  const source = String(text)
  const hits = []
  const section = classOn(source, "rich-paper-page")
  const sectionOverflow = lastBlockOverflow(section)
  const sectionTokens = tokens(section)
  if (
    !sectionTokens.includes("h-full") ||
    !sectionTokens.includes("min-h-0") ||
    !sectionTokens.includes("flex-col") ||
    !sectionOverflow ||
    !CLIP.test(sectionOverflow)
  )
    hits.push(
      "Rich Paper page must fill main and clip, so Next and Previous cannot scroll the find bar away"
    )
  const pane = classOn(source, "data-paper-document-pane")
  const paneOverflow = lastBlockOverflow(pane)
  if (
    !tokens(pane).includes("min-h-0") ||
    !paneOverflow ||
    !SCROLL.test(paneOverflow)
  )
    hits.push(
      "Rich Paper document pane must be the only scroll container under the header and find bar"
    )
  return hits
}
