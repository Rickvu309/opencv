const ROUTE_FILE = /^apps\/web\/src\/routes\/[^/]+\.tsx$/
const MOUNTS_EDITOR = /<PaperChrome\b/
const OPENS_SAVED_PAPER = /\bopenPaperSync\(/
const HOLDS_FOCUS = /\bholdWritingCoachFocus\(/

export function detect(source, file) {
  if (!ROUTE_FILE.test(file)) return []
  if (!MOUNTS_EDITOR.test(source) || !OPENS_SAVED_PAPER.test(source)) return []
  if (HOLDS_FOCUS.test(source)) return []
  return [
    `${file} opens a saved Paper in the editor without holdWritingCoachFocus, so the Coach does not see the open Paper`,
  ]
}
