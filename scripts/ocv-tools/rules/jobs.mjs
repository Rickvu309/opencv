import { issueOfBranch } from "./pull-ref.mjs"

const FINISH_TITLE = /^(feat|fix|hotfix|refactor|chore|docs): [^ ].* \(#\d+\)$/
const FIX_TITLE = /^(?:fix|hotfix)(?:\([^)]*\))?!?: /
const LOCAL_PATH = /\/home\/|~\/tmp/
const COMMAND_HEAD =
  /^(?:cd\s+\S+\s*&&\s*)?(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*(?:(?:pnpm|npm|npx|node|git|gh|curl|vitest|tsc|bash|docker|make|python3?)\s+(?:\S*[^\s:])|(?:\.?\/?scripts\/\S*[\w])|\.\/\S*[\w])/
const COUNTED_RESULT =
  /\bexit(?:s|ed)?(?: code| status)?\s*[:=]?\s*\d+|(?<![\w/.-])\d+\/\d+(?![\w/.-])|\b\d+\s+(?:(?:tests?|checks?|assertions?|specs?)\s+)?(?:pass(?:ed|es)?|fail(?:ed|s|ures?)?|ok)\b|\b(?:passed|failed)\s+\d+(?:,\d{3})*\s+(?:tests?|checks?|assertions?|specs?)\b|\b0\s+(?:mismatch(?:es)?|errors?|failures?|warnings?|violations?|findings?|offenders?|diffs?|differences|issues?)\b|\bno\s+(?:errors?|output|failures?|mismatch(?:es)?|warnings?|violations?|findings?|offenders?|diffs?|differences)\b|\bHTTP \d{3}\b/i
const VERDICT_WORD =
  "(?:pass(?:ed|es)?|fail(?:ed|s)?|success(?:ful)?|clean|ok)\\b(?!\\?)"
const SEPARATED_VERDICT = new RegExp(
  `(?:[:=(]|(?:^|\\s)(?:[-\u2013\u2014]|->|=>|\u2192)\\s)\\s*${VERDICT_WORD}`,
  "i"
)
const OUTPUT_VERDICT = new RegExp(`\\b${VERDICT_WORD}`, "i")
const NOT_A_RESULT = /\bnot run\b|\bnever ran\b|\bwould\b|\bshould\b|\bwill\b/i
const PICTURE = /!\[[^\]]*\]\([^)]+\)|<img\b/i
const PROOF_URL =
  /https?:\/\/github\.com\/[^/\s]+\/[^/\s]+\/(?:actions\/runs\/\d+|pull\/\d+\/checks)|https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|mp4|webm)\b|https?:\/\/github\.com\/user-attachments\//i
const ANY_URL = /https?:\/\/\S+/i
const LIST_MARKER = /^(?:[-*+]|\d+[.)]|>|\$)\s+/
const CAUGHT_BY =
  /^\**Caught by:\**\s*(?:user|ci|review|verify-skill|test|agent-self)\s*$/m
const INTRODUCED_BY =
  /^\**Introduced by:\**\s*(?:[0-9a-f]{7,40}|#\d+|unknown)\s*$/m
const FINISH_FIX = "Fix the cause, then run scripts/ocv-tools.mjs finish again."
const MERGE_FIX =
  "Wait for a green ci on the PR head, then run scripts/ocv-tools.mjs merge <pr#>."

const hasResult = (rest) =>
  COUNTED_RESULT.test(rest) || SEPARATED_VERDICT.test(rest)

function bareLine(line) {
  let text = line.trim()
  for (let i = 0; i < 2; i += 1) text = text.replace(LIST_MARKER, "")
  return text
}

function commandsIn(line) {
  const found = []
  for (const m of line.matchAll(/`([^`\n]+)`/g)) {
    const head = COMMAND_HEAD.exec(m[1].trim())
    if (head) found.push(line.slice(m.index + m[0].length))
  }
  const head = COMMAND_HEAD.exec(line)
  if (head) found.push(line.slice(head[0].length))
  return found
}

function lineProves(line) {
  if (NOT_A_RESULT.test(line)) return { proves: false, pending: false }
  const rests = commandsIn(line)
  const proves = rests.some(hasResult)
  const urlProof =
    PROOF_URL.test(line) || (ANY_URL.test(line) && hasResult(line))
  return { proves: proves || urlProof, pending: rests.length > 0 }
}

function hasRealEvidence(evidence) {
  if (PICTURE.test(evidence)) return true
  let inFence = false
  let pendingOutside = false
  let pendingInside = false
  for (const raw of evidence.split(/\r?\n/)) {
    const line = bareLine(raw)
    if (/^(?:```|~~~)/.test(line)) {
      pendingInside = !inFence && pendingOutside
      pendingOutside = false
      inFence = !inFence
      continue
    }
    if (inFence) {
      const { proves, pending } = lineProves(line)
      if (proves) return true
      if (pending) pendingInside = true
      else if (pendingInside && OUTPUT_VERDICT.test(line)) return true
      else if (pendingInside && COUNTED_RESULT.test(line)) return true
      continue
    }
    if (line === "") continue
    const { proves, pending } = lineProves(line)
    if (proves) return true
    pendingOutside = pending
  }
  return false
}

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/
const DETAILS_OPEN = /^ {0,3}<details(?:\s[^<>]*)?>/i
const DETAILS_CLOSE = /<\/details>\s*$/i
const RISK_LINE = /^\*\*Risk:\*\* \S/

function visibleBody(text) {
  const lines = []
  let fence = ""
  let fold = -1
  let depth = 0
  let hasDetails = false
  for (const line of text.split(/\r?\n/)) {
    const marker = FENCE.exec(line)
    const code = Boolean(fence || marker)
    const opens = !code && DETAILS_OPEN.test(line)
    if (opens) {
      if (depth === 0) fold = lines.length
      depth += 1
    }
    lines.push({ line, code })
    if (
      !code &&
      depth &&
      (opens || /^ {0,3}<\/details>/i.test(line)) &&
      DETAILS_CLOSE.test(line)
    ) {
      depth -= 1
      if (depth === 0) {
        lines.splice(fold, lines.length - fold, { line: "", details: true })
        hasDetails = true
      }
    }
    if (marker && !fence) fence = marker[1]
    else if (marker && marker[1].startsWith(fence) && !marker[2].trim())
      fence = ""
  }
  return { lines, hasDetails }
}

function proofOf(lines, start) {
  const proof = /^\*\*Proof:\*\* (\S.*)$/.exec(lines[start]?.line ?? "")
  if (!proof) return null
  const evidence = [proof[1]]
  let separated = false
  for (const { line, code, details } of lines.slice(start + 1)) {
    if (details) break
    if (!code && !line.trim()) {
      separated = true
      continue
    }
    if (
      !code &&
      (separated || /^(?:Closes #\d+\s*$|\*\*[^*]+:\*\*|#{1,6} )/.test(line))
    )
      break
    if (separated) evidence.push("")
    evidence.push(line)
    separated = false
  }
  return evidence.join("\n")
}

function badBody(facts) {
  const body = facts.body
  if (!body?.file) return "Pass --body-file <file>."
  if (body.unreadable) return `The body file ${body.file} cannot be read.`
  const text = body.text ?? ""
  const { lines, hasDetails } = visibleBody(text)
  const first = lines.findIndex(({ line, details }) => details || line.trim())
  const lead = /^Closes #\d+\s*$/.test(lines[first]?.line ?? "")
    ? lines.findIndex(
        ({ line, details }, index) => index > first && (details || line.trim())
      )
    : first
  const answer = lines[lead]?.line ?? ""
  const proof = lines.findIndex(
    ({ line, details }, index) => index > lead && (details || line.trim())
  )
  const evidence = /^\*\*Now:\*\* \S/.test(answer)
    ? proofOf(lines, proof)
    : !/^\*\*(?:Now|Proof|Risk):\*\*/.test(answer) &&
        /^\*\*\S(?:.*\S)?\*\*$/.test(answer) &&
        hasDetails
      ? text
      : null
  const problems = []
  if (evidence === null)
    problems.push(
      "Start the PR body with **Now:** <text> followed by **Proof:** <text>, or a bold answer followed by a <details> block."
    )
  if (lines.filter(({ line }) => line.trim()).length > 25)
    problems.push(
      "The PR body allows at most 25 non-empty lines outside <details>. Fenced code lines count."
    )
  if (
    facts.migrations?.files.length &&
    !lines.some(({ line, code }) => !code && RISK_LINE.test(line))
  )
    problems.push(
      "A PR with a migration needs a **Risk:** <text> line outside <details>."
    )
  if (/<(diagram|screenshot|one-way|optional)[^>]*>/.test(text))
    problems.push("Fill in all template placeholders.")
  if (LOCAL_PATH.test(text))
    problems.push(
      "The PR body names a path on your machine (/home/ or ~/tmp). Show the command and its result, or link a picture."
    )
  if (evidence !== null && !hasRealEvidence(evidence))
    problems.push(
      "Proof needs a command with its result on the same line or in the output block under it (exit 0, N passed, 0 mismatches), an image, or a link to a CI run."
    )
  if (FIX_TITLE.test(facts.pull?.title ?? "")) {
    if (!CAUGHT_BY.test(text))
      problems.push(
        "A fix needs a line: Caught by: user|ci|review|verify-skill|test|agent-self"
      )
    if (!INTRODUCED_BY.test(text))
      problems.push("A fix needs a line: Introduced by: <sha>|#<pr>|unknown")
  }
  if (!problems.length) return null
  if (problems.length === 1) return problems[0]
  return `${problems.length} problems. ${problems.map((line, i) => `(${i + 1}) ${line}`).join(" ")}`
}

const badTitle = (facts) =>
  FINISH_TITLE.test(facts.pull?.title ?? "") ? null : "The PR title is invalid."

const noCommits = (facts) =>
  facts.commits?.count === 0 ? "No commits beyond origin/main." : null

const staleCheck = ({ snapshot }) =>
  JSON.stringify(snapshot.before) === JSON.stringify(snapshot.after)
    ? null
    : "The saved work changed during push. Finish again."

const prNo = (facts) => facts.pull?.n ?? facts.queue?.n ?? "<pr#>"

const draft = (facts) =>
  facts.pull.isDraft ? `PR #${prNo(facts)} is a draft.` : null

const badBranch = (facts) =>
  issueOfBranch(facts.pull.branch) == null
    ? `PR #${prNo(facts)} has no linked issue in its branch name.`
    : null

const closedPr = (facts) =>
  ["OPEN", "MERGED"].includes(facts.pull.state)
    ? null
    : `PR #${prNo(facts)} is ${facts.pull.state}.`

function ciRequired(facts) {
  const { pull, ci } = facts
  if (pull.state !== "OPEN") return null
  if (
    ci &&
    ci.status === "completed" &&
    ci.conclusion === "success" &&
    ci.head === pull.head
  )
    return null
  return `The ci check on head ${pull.head} is ${ci?.conclusion ?? "pending or missing"}, not success.`
}

const billingOf = (facts) => facts.billing ?? null

const billingBlocked = (facts) => {
  const found = billingOf(facts)
  if (!found) return null
  return `CI cannot run on PR #${prNo(facts)}: GitHub did not start run ${found.runId} because the account's payments failed or its Actions spending limit is used up. A rerun or a new merge will not help.`
}

const billingFix = (facts) =>
  `Stop and tell the owner: open Billing & plans in the Rickvu309 organization settings, fix the failed payment or raise the Actions spending limit. After that, run scripts/ocv-tools.mjs merge ${prNo(facts)} --wait once`

function row(spec) {
  return {
    kind: "precondition",
    section: "4",
    needs: [],
    fix: () => FINISH_FIX,
    ...spec,
  }
}

export const jobRows = [
  row({
    id: "STALE_CHECK",
    says: "The saved work changed during push.",
    at: ["finish-pushed"],
    needs: ["snapshot"],
    check: staleCheck,
  }),
  row({
    id: "BAD_BODY",
    says: "The PR body opens with Now and Proof, or a bold answer followed by a details block. Proof shows a command and result, an image, or a link to a CI run. At most 25 non-empty lines are visible, including fenced code lines. A PR with a migration names its Risk. Fill in all template placeholders. The body names no path under /home/ or ~/tmp. A fix or hotfix PR adds Caught by and Introduced by lines.",
    at: ["finish", "body"],
    needs: ["body", "pull", "migrations"],
    check: badBody,
  }),
  row({
    id: "BAD_TITLE",
    says: "The PR title is type: description (#n).",
    at: ["finish"],
    needs: ["pull"],
    check: badTitle,
  }),
  row({
    id: "NO_COMMITS",
    says: "There are no commits beyond origin/main.",
    at: ["finish"],
    needs: ["commits"],
    check: noCommits,
  }),
  row({
    id: "DRAFT",
    section: "6",
    says: "A draft PR cannot merge.",
    at: ["merge"],
    needs: ["pull"],
    check: draft,
    fix: (facts) => `Run: gh pr ready ${prNo(facts)}`,
  }),
  row({
    id: "BAD_BRANCH",
    section: "6",
    says: "The PR branch must name its issue.",
    at: ["merge"],
    needs: ["pull"],
    check: badBranch,
    fix: () => "Rename the branch type/<issue#>-short-description and reopen.",
  }),
  row({
    id: "CLOSED_PR",
    section: "6",
    says: "The PR must be open or already merged.",
    at: ["merge"],
    needs: ["pull"],
    check: closedPr,
    fix: () => "Open a new PR with scripts/ocv-tools.mjs finish.",
  }),
  row({
    id: "BILLING_BLOCKED",
    section: "6",
    says: "CI must have been able to start; a billing block needs the owner.",
    at: ["merge"],
    check: billingBlocked,
    fix: billingFix,
    exit: "HUMAN",
  }),
  row({
    id: "CI_REQUIRED",
    section: "6",
    says: "The newest ci check must succeed on the PR head.",
    at: ["merge"],
    needs: ["pull", "ci"],
    check: ciRequired,
    fix: (facts) =>
      facts.pull?.head
        ? `Run: gh run list --workflow ci.yml --commit ${facts.pull.head}`
        : MERGE_FIX,
  }),
]
