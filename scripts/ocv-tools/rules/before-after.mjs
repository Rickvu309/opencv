const UI_SOURCE =
  /^(?:apps\/web\/src\/(?:features|components)|packages\/ui\/src)\/.+\.(?:tsx|css)$/
const NOT_SHOWN = /[.-](?:test|spec)\.tsx$|(?:^|\/)(?:test|tests|__tests__)\//
const HEADING = "Before / after"
const PICTURE = /!\[[^\]]*\]\([^)]+\)|<img\b/i
const TABLE_HEAD = /^\|\s*main\s*\|\s*this PR\s*\|\s*$/m
const NO_CHANGE = /^No visible change\.[ \t]*$/m
const REASON_WORDS = 4
export const BEFORE_AFTER_FIX =
  "Run node scripts/ui.mjs compare <screen...>, then changes --spec <spec.json>, annotate --spec <spec.json> --out <png>, and pr-section --annotated <png>; paste its ## Before / after section into the body. If nothing on screen changed, write the line No visible change. under that heading with one sentence of reason."

const asLines = (value) =>
  Array.isArray(value)
    ? value
    : String(value ?? "")
        .split("\n")
        .filter(Boolean)

export function shownUiFiles(files) {
  return asLines(files).filter(
    (file) => UI_SOURCE.test(file) && !NOT_SHOWN.test(file)
  )
}

function section(text) {
  const start = new RegExp(`^## ${HEADING}\\r?$`, "m").exec(text)
  if (!start) return null
  const rest = text.slice(start.index + start[0].length)
  const next = /^## /m.exec(rest)
  return (next ? rest.slice(0, next.index) : rest).trim()
}

function honestNoChange(body) {
  const match = NO_CHANGE.exec(body)
  if (!match) return false
  const reason = body
    .slice(match.index + match[0].length)
    .replace(/\s+/g, " ")
    .trim()
  return reason.split(" ").filter(Boolean).length >= REASON_WORDS
}

export function beforeAfterProblem(text, files) {
  const shown = shownUiFiles(files)
  if (!shown.length) return null
  const body = section(String(text ?? ""))
  const changed = `the change edits ${shown.length} screen file(s) (${shown.slice(0, 2).join(", ")}${shown.length > 2 ? ", ..." : ""})`
  if (body == null)
    return `${changed} but the PR body has no ## ${HEADING} section`
  if (honestNoChange(body)) return null
  if (NO_CHANGE.test(body))
    return `${changed}; No visible change. needs one sentence of reason after it`
  const missing = [
    PICTURE.test(body) ? null : "an image",
    TABLE_HEAD.test(body) ? null : "a | main | this PR | table",
  ].filter(Boolean)
  if (!missing.length) return null
  return `${changed} but ## ${HEADING} lacks ${missing.join(" and ")}`
}

const bodyText = (facts) => facts.pull?.body ?? facts.body?.text ?? ""

export const beforeAfterRows = [
  {
    id: "NO_BEFORE_AFTER",
    kind: "rule",
    section: "4",
    says: "A PR that edits screen files under apps/web/src/features, apps/web/src/components or packages/ui/src (tsx, css; not tests) has a ## Before / after section with an image and a | main | this PR | table, or the line No visible change. with one sentence of reason.",
    at: ["finish", "pr"],
    needs: ["pull", "diff"],
    check: (facts) => beforeAfterProblem(bodyText(facts), facts.diff?.files),
    fix: () => BEFORE_AFTER_FIX,
  },
]
