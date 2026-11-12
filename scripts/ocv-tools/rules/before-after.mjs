const UI_SOURCE =
  /^(?:apps\/web\/src\/(?:features|components)|packages\/ui\/src)\/.+\.(?:tsx|css)$/
const NOT_SHOWN = /[.-](?:test|spec)\.tsx$|(?:^|\/)(?:test|tests|__tests__)\//
const HEADING = "Before / after"
const PICTURE = /!\[[^\]]*\]\([^)]+\)|<img\b/i
const TABLE_HEAD = /^\|\s*main\s*\|\s*this PR\s*\|\s*$/m
const NO_CHANGE = /No visible change\./
export const BEFORE_AFTER_FIX =
  "Run node scripts/ui.mjs compare <screen...>, then changes --spec <spec.json>, annotate --spec <spec.json> --out <png>, and pr-section --annotated <png>; paste its ## Before / after section into the body. A screen file that changed with nothing visible still needs the compare pictures that show it; No visible change. alone is only for a PR that edits no screen file."

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

function stackedNote(base) {
  if (!base || base === "main") return ""
  return `; this PR is stacked on ${base}, so its diff against main also holds that branch's screen files: merge ${base} first and rebase, or show those screens here too`
}

export function beforeAfterProblem(text, files, { base } = {}) {
  const shown = shownUiFiles(files)
  if (!shown.length) return null
  const whole = String(text ?? "")
  const body = section(whole)
  const changed = `the change edits ${shown.length} screen file(s) (${shown.slice(0, 2).join(", ")}${shown.length > 2 ? ", ..." : ""})`
  const stacked = stackedNote(base)
  if (body == null && !NO_CHANGE.test(whole))
    return `${changed} but the PR body has no ## ${HEADING} section${stacked}`
  const missing = [
    PICTURE.test(body ?? "") ? null : "an image",
    TABLE_HEAD.test(body ?? "") ? null : "a | main | this PR | table",
  ].filter(Boolean)
  if (!missing.length) return null
  if (NO_CHANGE.test(whole))
    return `${changed}, so "No visible change." is a claim the pictures must show: put the compare image and the | main | this PR | table under ## ${HEADING}${stacked}`
  return `${changed} but ## ${HEADING} lacks ${missing.join(" and ")}${stacked}`
}

const bodyText = (facts) => facts.pull?.body ?? facts.body?.text ?? ""

export const beforeAfterRows = [
  {
    id: "NO_BEFORE_AFTER",
    kind: "rule",
    section: "4",
    says: "A PR that edits screen files under apps/web/src/features, apps/web/src/components or packages/ui/src (tsx, css; not tests) has a ## Before / after section with an image and a | main | this PR | table. No visible change. is refused while such a file changes, unless the pictures show it.",
    at: ["finish", "body", "pr"],
    needs: ["pull", "diff"],
    check: (facts) =>
      beforeAfterProblem(bodyText(facts), facts.diff?.files, {
        base: facts.pull?.base,
      }),
    fix: () => BEFORE_AFTER_FIX,
  },
]
