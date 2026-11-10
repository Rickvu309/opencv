import { TYPES } from "../fields.mjs"
import { FIXES } from "../result.mjs"

const TYPE_LIST = TYPES.join(", ")
const MAX_WORDS = 5

export function issueKind(issue, flags = {}) {
  if (flags["--type"]) return flags["--type"]
  if (issue?.type) return issue.type
  const body = issue?.body ?? ""
  return (
    TYPES.find((t) => new RegExp(`^### Type\\s+${t}\\s*$`, "m").test(body)) ??
    null
  )
}

function slugOf(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, MAX_WORDS)
    .join("-")
}

function missingFields(facts) {
  if (facts.missingValue) return `${facts.missingValue} needs a value`
  const draft = facts.draft
  if (draft?.problems?.length) return draft.problems.join("; ")
  if (facts.requireKind && !issueKind(facts.issue, facts.flags ?? {}))
    return `#${facts.issue.n} has no Type (${TYPE_LIST})`
  if ("desc" in facts && !slugOf(facts.desc ?? ""))
    return `description "${facts.desc}" has no usable characters; pass -d`
  if (typeof facts.type === "string" && !TYPES.includes(facts.type))
    return `type must be one of: ${TYPE_LIST}`
  if (
    facts.validateType &&
    facts.flags?.["--type"] != null &&
    !TYPES.includes(facts.flags["--type"])
  )
    return `type must be one of: ${TYPE_LIST}`
  return null
}

function missingFieldsFix(facts) {
  const retry = facts.draft?.retry
  return retry
    ? `Fill in what is missing and run: ${retry}`
    : FIXES.MISSING_FIELDS
}

function unreadable(facts) {
  const reasons = facts.draft?.reasons
  if (!reasons?.length) return null
  return reasons.join("; ")
}

function unknownCommand(facts) {
  const command = facts.command
  if (!command || command.known) return null
  const noun = command.noun ?? "command"
  return `no ${noun} "${command.name}"; ${noun}s are ${command.names}`
}

function unknownFlag(facts) {
  const flag = facts.flag
  if (!flag || flag.known) return null
  return flag.hint
    ? `unknown option: ${flag.name} (use ${flag.hint})`
    : `unknown option: ${flag.name}`
}

function badArgs(facts) {
  const args = facts.args
  if (!args || args.ok) return null
  if (args.shot) return "pass --pr or --issue, not both"
  return args.both
    ? "pass an issue number or a title, not both"
    : `expected one target, got ${args.count}`
}

function badArgsFix(facts) {
  if (facts.args?.shot)
    return "Pass one of --pr or --issue. Run: scripts/ocv-tools.mjs help"
  return FIXES.BAD_ARGS
}

function badIssue(facts) {
  const token = facts.token
  if (!token || token.ok) return null
  return `"${token.text}" is not an issue number`
}

const PICTURE_BYTES = 10 * 1024 * 1024

function missingFile(facts) {
  const p = facts.pictures.find((item) => item.exists === false)
  return p ? `${p.path} does not exist` : null
}

function badPicture(facts) {
  for (const p of facts.pictures) {
    const bad = `${p.path} is not a png, jpg, gif or webp`
    if (p.file === false) return bad
    if (p.bytesChecked === false) return `${bad} (checked the file bytes)`
    if (p.clash) return `two files would be named ${p.asset}`
  }
  return null
}

function badPictureFix(facts) {
  if (facts.pictures?.some((item) => item.clash))
    return "Pass --name, or rename one file so the pictures stay distinct."
  return FIXES.BAD_PICTURE
}

function tooBig(facts) {
  const p = facts.pictures.find(
    (item) => item.bytes != null && item.bytes > PICTURE_BYTES
  )
  return p ? `${p.path} is over 10 MB` : null
}

function tooMany(facts) {
  const count = facts.shot?.count
  if (count == null || count <= 20) return null
  return `shot takes at most 20 pictures per run (${count} given)`
}

export function rule(spec) {
  return {
    kind: "rule",
    needs: [],
    at: [],
    fix: () => FIXES[spec.id],
    ...spec,
  }
}

function judgment(spec) {
  return {
    kind: "judgment",
    at: [],
    needs: [],
    check: null,
    fix: () => "None",
    ...spec,
  }
}

export const tableRows = [
  rule({
    id: "MISSING_FIELDS",
    kind: "precondition",
    section: "1",
    says: "A task needs its type, title, description and the flags the command asked for.",
    at: ["file", "take", "cli", "shot"],
    needs: ["flags"],
    stop: true,
    check: missingFields,
    fix: missingFieldsFix,
  }),
  rule({
    id: "UNREADABLE",
    section: "1",
    says: "Plain sections need every required part, no code formatting, no file names, a short and concrete Done when list, and a bounded length. Jargon, long sentences and a high reading grade only warn.",
    at: ["file"],
    needs: ["draft"],
    check: unreadable,
  }),
  rule({
    id: "UNKNOWN_COMMAND",
    kind: "precondition",
    says: "The command must be one of the jobs help lists.",
    at: ["cli"],
    needs: ["command"],
    check: unknownCommand,
  }),
  rule({
    id: "UNKNOWN_FLAG",
    kind: "precondition",
    says: "A flag must be one this command accepts.",
    at: ["cli", "shot"],
    needs: ["flag"],
    check: unknownFlag,
  }),
  rule({
    id: "BAD_ARGS",
    kind: "precondition",
    says: "Pass one target, an issue number or a title.",
    at: ["cli", "shot"],
    needs: ["args"],
    check: badArgs,
    fix: badArgsFix,
  }),
  rule({
    id: "BAD_ISSUE",
    kind: "precondition",
    says: "An issue target must be a whole number of 1 or more.",
    at: ["cli"],
    needs: ["token"],
    check: badIssue,
  }),
  rule({
    id: "MISSING_FILE",
    kind: "precondition",
    says: "A picture passed to shot must exist on disk.",
    at: ["shot"],
    needs: ["pictures"],
    stop: true,
    check: missingFile,
  }),
  rule({
    id: "BAD_PICTURE",
    kind: "precondition",
    says: "A shot picture must be a png, jpg, gif or webp, with its own name.",
    at: ["shot", "shot-target"],
    needs: ["pictures"],
    stop: true,
    check: badPicture,
    fix: badPictureFix,
  }),
  rule({
    id: "TOO_BIG",
    kind: "precondition",
    says: "A shot picture must be 10 MB or smaller.",
    at: ["shot"],
    needs: ["pictures"],
    stop: true,
    check: tooBig,
  }),
  rule({
    id: "TOO_MANY",
    kind: "precondition",
    says: "Shot takes at most 20 pictures in one run.",
    at: ["shot"],
    needs: ["shot"],
    stop: true,
    check: tooMany,
  }),
]

export const judgmentRows = [
  judgment({
    id: "OTHER_WORKTREE",
    section: "2",
    says: "Never touch another agent's worktree.",
    why: "Git records no agent identity, so nothing tells whose hands edited a worktree.",
  }),
  judgment({
    id: "SPLIT_SUBISSUES",
    section: "1",
    says: "Split long work into sub-issues.",
    why: "A size judgment. Nothing measures it.",
  }),
  judgment({
    id: "VERIFY_BY_HAND",
    section: "4",
    says: "Verify the change by hand before marking a pull request ready.",
    why: "Run a verify skill by hand. Nothing checks it at merge.",
  }),
  judgment({
    id: "OWN_IDENTITY",
    section: "5",
    says: "Never approve with another identity.",
    why: "One account. GitHub cannot tell two agents apart.",
  }),
  judgment({
    id: "CLEANUP_BY_HAND",
    section: "6",
    says: "Remove the worktree after the merge.",
    why: "ocv-tools cleanup is run by hand.",
  }),
]
