// `shot`: upload pictures to the screenshots release and post them on an issue or pull request.
// Pictures stay off main. The release is created as a prerelease when it is missing.
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  rmSync,
  statSync,
} from "node:fs"
import { basename, join } from "node:path"
import { taskHere } from "./claim.mjs"
import { SCRATCH } from "./ports/fs.mjs"
import { Refused } from "./result.mjs"

const USAGE =
  "usage: ocv-tools shot <file...> [--pr <n> | --issue <n>] [--name <what>] [--no-comment]"
const FLAGS = new Set(["--pr", "--issue", "--name", "--no-comment"])
const RELEASE = "screenshots"
const NOTES = "Pictures for issues and pull requests. Not a product release."
const MAX_PICTURES = 20
const MAX_BYTES = 10 * 1024 * 1024
const COMMENT_MAX = 60000
const SLUG_MAX = 40

const slug = (text, max = SLUG_MAX) => {
  const raw = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, Math.max(1, max))
    .replace(/-+$/g, "")
  return raw || "picture"
}

function positive(text) {
  if (text == null || text === true || text === "") throw new Error(USAGE)
  const n = Number(String(text).replace(/^#/, ""))
  if (!Number.isInteger(n) || n < 1) throw new Error(USAGE)
  return n
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPG = [0xff, 0xd8, 0xff]
const GIF87 = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]
const GIF89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]
const RIFF = [0x52, 0x49, 0x46, 0x46]
const WEBP = [0x57, 0x45, 0x42, 0x50]

// Exact bytes. ASCII decoding drops the high bit and would accept non-pictures.
const at = (buf, start, sig) => {
  if (buf.length < start + sig.length) return false
  for (let i = 0; i < sig.length; i++)
    if (buf[start + i] !== sig[i]) return false
  return true
}

// png, jpg, gif and webp, by the leading bytes. The file name is not trusted.
export function pictureType(bytes) {
  const b = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  if (at(b, 0, PNG)) return "png"
  if (at(b, 0, JPG)) return "jpg"
  if (at(b, 0, GIF87) || at(b, 0, GIF89)) return "gif"
  if (at(b, 0, RIFF) && at(b, 8, WEBP)) return "webp"
  return null
}

function readHead(path) {
  const fd = openSync(path, "r")
  try {
    const buf = Buffer.alloc(16)
    const n = readSync(fd, buf, 0, 16, 0)
    return buf.subarray(0, n)
  } finally {
    closeSync(fd)
  }
}

function inspect(path) {
  if (!existsSync(path))
    throw new Refused(
      "MISSING_FILE",
      `${path} does not exist`,
      "Check the path and pass a picture that exists."
    )
  let st
  try {
    st = statSync(path)
  } catch (error) {
    if (error?.code === "ENOENT")
      throw new Refused(
        "MISSING_FILE",
        `${path} does not exist`,
        "Check the path and pass a picture that exists."
      )
    throw error
  }
  if (!st.isFile())
    throw new Refused(
      "BAD_PICTURE",
      `${path} is not a png, jpg, gif or webp`,
      "Pass a picture file (.png, .jpg, .gif or .webp)."
    )
  if (st.size > MAX_BYTES)
    throw new Refused(
      "TOO_BIG",
      `${path} is over 10 MB`,
      "Pass a picture under 10 MB."
    )
  const type = pictureType(readHead(path))
  if (!type)
    throw new Refused(
      "BAD_PICTURE",
      `${path} is not a png, jpg, gif or webp (checked the file bytes)`,
      "Pass a picture file (.png, .jpg, .gif or .webp)."
    )
  return { file: path, type }
}

// Names carry the target, so two tasks do not overwrite each other.
export function shotAssets(items, { kind, n, name }) {
  const seen = new Set()
  const many = Boolean(name) && items.length > 1
  const reserve = many ? String(items.length).length + 1 : 0
  const shared = many ? slug(name, SLUG_MAX - reserve) : null
  return items.map((item, i) => {
    const base = basename(item.file).replace(/\.[^.]+$/, "")
    const what = shared ? `${shared}-${i + 1}` : slug(name || base)
    const asset = `${kind}-${n}-${what}.${item.type}`
    if (seen.has(asset))
      throw new Refused(
        "BAD_PICTURE",
        `two files would be named ${asset}`,
        "Pass --name, or rename one file so the pictures stay distinct."
      )
    seen.add(asset)
    return { ...item, asset, alt: what.replaceAll("-", " ") }
  })
}

export const shotLink = (repo, item) =>
  `![${item.alt}](https://github.com/${repo}/releases/download/${RELEASE}/${item.asset})`

export const shotBody = (repo, items) =>
  `Pictures from the agent:\n\n${items.map((item) => shotLink(repo, item)).join("\n\n")}`

// GitHub rejects an issue comment at 65536 characters. Stay under 60000.
export function shotComments(repo, items) {
  const chunks = []
  let batch = []
  const take = (group) => {
    const body = shotBody(repo, group)
    if (body.length >= COMMENT_MAX)
      throw new Refused(
        "UNKNOWN",
        "one picture comment is over 60000 characters",
        "Use a shorter --name. Run: scripts/ocv-tools.mjs help"
      )
    chunks.push(body)
  }
  for (const item of items) {
    if (
      batch.length &&
      shotBody(repo, [...batch, item]).length >= COMMENT_MAX
    ) {
      take(batch)
      batch = []
    }
    batch.push(item)
  }
  if (batch.length) take(batch)
  return chunks
}

function targetOf(ctx, { pr, issue }) {
  if (pr) return { kind: "pr", n: pr }
  if (issue) return { kind: "issue", n: issue }
  try {
    return { kind: "issue", n: taskHere(ctx).n }
  } catch (error) {
    if (error instanceof Refused && error.code === "NOT_A_TASK")
      throw new Refused(
        "NOT_A_TASK",
        error.message,
        "Pass --issue <n> or --pr <n>, or run shot inside the task worktree."
      )
    throw error
  }
}

function ensureRelease(gh) {
  if (gh.releaseView(RELEASE)) return
  gh.releaseCreate(RELEASE, { title: RELEASE, notes: NOTES, target: "main" })
}

function requireTarget(gh, { kind, n }) {
  const ok = kind === "pr" ? gh.viewPr(n) : gh.viewIssue(n)
  if (ok) return
  throw new Refused(
    "NOT_AN_ISSUE",
    kind === "pr" ? `#${n} is not a pull request` : `#${n} is not an issue`,
    kind === "pr"
      ? "Pass a pull request number to --pr. Run: gh pr list"
      : "Pass an issue number to --issue. Run: gh issue list"
  )
}

export function shot(ctx, { files = [], flags = {} } = {}) {
  const unknown = Object.keys(flags).find((key) => !FLAGS.has(key))
  if (unknown) throw new Refused("UNKNOWN_FLAG", `unknown option: ${unknown}`)
  if (!files.length) throw new Error(USAGE)
  if (files.length > MAX_PICTURES)
    throw new Refused(
      "TOO_MANY",
      `shot takes at most 20 pictures per run (${files.length} given)`,
      "Pass at most 20 pictures in one run."
    )
  if ("--pr" in flags && "--issue" in flags)
    throw new Refused(
      "BAD_ARGS",
      "pass --pr or --issue, not both",
      "Pass one of --pr or --issue. Run: scripts/ocv-tools.mjs help"
    )
  if ("--name" in flags && !flags["--name"])
    throw new Refused("MISSING_FIELDS", "--name needs a value")
  const pr = "--pr" in flags ? positive(flags["--pr"]) : null
  const issue = "--issue" in flags ? positive(flags["--issue"]) : null
  // Bytes first, so a bad picture never reaches git or GitHub.
  const pictures = files.map(inspect)
  const target = targetOf(ctx, { pr, issue })
  const items = shotAssets(pictures, {
    kind: target.kind,
    n: target.n,
    name: flags["--name"],
  })
  const repo = ctx.ports.gh.repo().nameWithOwner
  const bodies = flags["--no-comment"] ? [] : shotComments(repo, items)
  requireTarget(ctx.ports.gh, target)
  ensureRelease(ctx.ports.gh)
  const dir = ctx.shotDir ?? join(SCRATCH, "shots")
  mkdirSync(dir, { recursive: true })
  const staged = []
  try {
    for (const item of items) {
      const to = join(dir, item.asset)
      copyFileSync(item.file, to)
      staged.push(to)
    }
    ctx.ports.gh.releaseUpload(RELEASE, staged)
    for (const body of bodies) {
      if (target.kind === "pr") ctx.ports.gh.commentPr(target.n, body)
      else ctx.ports.gh.comment(target.n, body)
    }
  } finally {
    for (const path of staged) rmSync(path, { force: true })
  }
  const links = items.map((item) => shotLink(repo, item))
  const commented = bodies.length > 0
  const where =
    target.kind === "pr" ? `pull request #${target.n}` : `#${target.n}`
  return {
    lines: [
      `Uploaded ${items.length} picture(s) to release ${RELEASE} (not committed).`,
      ...links,
      commented
        ? `Commented on ${where}.`
        : "No comment posted (--no-comment).",
    ],
    next:
      target.kind === "pr"
        ? `Pictures are on pull request #${target.n}. Run: scripts/review-pr.sh ${target.n}`
        : `Pictures are on #${target.n}. Run: scripts/ocv-tools.mjs status ${target.n}`,
  }
}
