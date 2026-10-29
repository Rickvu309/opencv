// `shot`: upload pictures to the screenshots release and post them on an issue or pull request.
// Pictures stay off main. The release is created as a prerelease when it is missing.
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  statSync,
} from "node:fs"
import { basename, join } from "node:path"
import { Refused, SCRATCH, gh } from "./core.mjs"
import { taskHere } from "./claim.mjs"

const USAGE =
  "usage: ocv-tools shot <file...> [--pr <n> | --issue <n>] [--name <what>] [--no-comment]"
const FLAGS = new Set(["--pr", "--issue", "--name", "--no-comment"])
const RELEASE = "screenshots"
const NOTES = "Pictures for issues and pull requests. Not a product release."

const slug = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "picture"

function positive(text) {
  if (text == null || text === true || text === "") throw new Error(USAGE)
  const n = Number(String(text).replace(/^#/, ""))
  if (!Number.isInteger(n) || n < 1) throw new Error(USAGE)
  return n
}

// png, jpg, gif and webp, by the leading bytes. The file name is not trusted.
export function pictureType(bytes) {
  const b = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  )
    return "png"
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return "jpg"
  if (b.length >= 6) {
    const head = b.subarray(0, 6).toString("ascii")
    if (head === "GIF87a" || head === "GIF89a") return "gif"
  }
  if (
    b.length >= 12 &&
    b.subarray(0, 4).toString("ascii") === "RIFF" &&
    b.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "webp"
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
  return items.map((item, i) => {
    const base = basename(item.file).replace(/\.[^.]+$/, "")
    const what = slug(
      name ? (items.length > 1 ? `${name}-${i + 1}` : name) : base
    )
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

function ensureRelease(ctx) {
  const view = ctx.run("gh", ["release", "view", RELEASE])
  if (view.ok) return
  gh(
    ctx,
    "release",
    "create",
    RELEASE,
    "--title",
    RELEASE,
    "--notes",
    NOTES,
    "--prerelease",
    "--target",
    "main"
  )
}

function requireTarget(ctx, { kind, n }) {
  const cmd = kind === "pr" ? "pr" : "issue"
  const view = ctx.run("gh", [cmd, "view", String(n), "--json", "number"])
  if (view.ok) return
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
  const repo = JSON.parse(
    gh(ctx, "repo", "view", "--json", "nameWithOwner")
  ).nameWithOwner
  requireTarget(ctx, target)
  ensureRelease(ctx)
  const dir = ctx.shotDir ?? join(SCRATCH, "shots")
  mkdirSync(dir, { recursive: true })
  const staged = items.map((item) => {
    const to = join(dir, item.asset)
    copyFileSync(item.file, to)
    return to
  })
  gh(ctx, "release", "upload", RELEASE, ...staged, "--clobber")
  const links = items.map((item) => shotLink(repo, item))
  let commented = false
  if (!flags["--no-comment"]) {
    gh(
      ctx,
      target.kind === "pr" ? "pr" : "issue",
      "comment",
      String(target.n),
      "--body",
      shotBody(repo, items)
    )
    commented = true
  }
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
