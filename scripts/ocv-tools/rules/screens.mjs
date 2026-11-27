const UI_SOURCE =
  /^(?:apps\/web\/src\/(?:features|components)|packages\/ui\/src)\/.+\.(?:tsx|css)$/
const NOT_SHOWN = /[.-](?:test|spec)\.tsx$|(?:^|\/)(?:test|tests|__tests__)\//
const HEADING = /^ {0,3}##[ \t]+Before \/ after(?:[ \t]+#+)?[ \t]*$/
const NEXT_SECTION = /^ {0,3}#{1,2}(?:[ \t]|$)/
const PUBLISHED =
  /^https:\/\/github\.com\/Rickvu309\/opencv\/releases\/download\/screenshots(?:-(?:[2-9]|[1-9]\d+))?\/[a-z0-9_.-]+\.(?:png|jpe?g|gif|webp)$/i
const MARKDOWN_IMAGE =
  /(?<!\\)!\[[^\]]*\]\(<?(https:\/\/[^\s)<>]+)>?(?:[ \t]+["'][^)]*["'])?\)/gi
const HTML_IMAGE =
  /<img\b[^<>]*?\ssrc\s*=\s*["'](https:\/\/[^"']+)["'][^<>]*>/gi
const NO_VISIBLE_CHANGE = /^ {0,3}No visible change:[ \t]+(.+)$/

export const SCREEN_BODY_FIX =
  "Run node scripts/ui.mjs shot <screen>, then node scripts/ocv-tools.mjs shot <png> --no-comment. Paste the printed links under ## Before / after. If the screen looks the same, add No visible change: <why> there with at least four words of reason."

export function shownUiFiles(files) {
  const paths = Array.isArray(files) ? files : String(files ?? "").split("\n")
  return paths.filter((path) => UI_SOURCE.test(path) && !NOT_SHOWN.test(path))
}

function hasScreenEvidence(line) {
  const reason = NO_VISIBLE_CHANGE.exec(line)?.[1]
  const words = reason?.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []
  if (words.length >= 4) return true
  const prose = line.replace(/(`+).*?\1/g, "")
  return [
    ...prose.matchAll(MARKDOWN_IMAGE),
    ...prose.matchAll(HTML_IMAGE),
  ].some(([, url]) => PUBLISHED.test(url))
}

export function screenBodyProblem(lines, files) {
  const shown = shownUiFiles(files)
  if (!shown.length) return null
  const start = lines.findIndex(({ line, code }) => !code && HEADING.test(line))
  const changed = `This PR edits ${shown.length} screen file(s), including ${shown[0]}.`
  if (start < 0) return `${changed} Add a ## Before / after section.`
  for (const { line, code } of lines.slice(start + 1)) {
    if (code || /^(?: {4}|\t)/.test(line)) continue
    if (NEXT_SECTION.test(line)) break
    if (hasScreenEvidence(line)) return null
  }
  return `${changed} Add a published screenshot or a No visible change: <why> line with at least four words of reason under ## Before / after.`
}
