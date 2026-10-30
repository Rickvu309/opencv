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
import { taskNow } from "./claim.mjs"
import { SCRATCH } from "./ports/fs.mjs"
import { decide, refusalError } from "./rules/index.mjs"

const USAGE =
  "usage: ocv-tools shot <file...> [--pr <n> | --issue <n>] [--name <what>] [--no-comment]"
const FLAGS = new Set(["--pr", "--issue", "--name", "--no-comment"])
const RELEASE = "screenshots"
const NOTES = "Pictures for issues and pull requests. Not a product release."
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

// What the shot rows read about one file: it exists, is a file, its size and
// what its first bytes say it is.
function inspect(path) {
  if (!existsSync(path)) return { path, exists: false }
  let st
  try {
    st = statSync(path)
  } catch (error) {
    if (error?.code === "ENOENT") return { path, exists: false }
    throw error
  }
  if (!st.isFile()) return { path, exists: true, file: false }
  const type = pictureType(readHead(path))
  return {
    path,
    exists: true,
    file: true,
    bytes: st.size,
    type,
    bytesChecked: Boolean(type),
  }
}

const decided = (verdict) => {
  if (!verdict.ok) throw refusalError(verdict.refusals[0])
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
    const clash = seen.has(asset)
    seen.add(asset)
    return { ...item, asset, clash, alt: what.replaceAll("-", " ") }
  })
}

export const shotLink = (repo, item) =>
  `![${item.alt}](https://github.com/${repo}/releases/download/${RELEASE}/${item.asset})`

export const shotBody = (repo, items) =>
  `Pictures from the agent:\n\n${items.map((item) => shotLink(repo, item)).join("\n\n")}`

// GitHub rejects an issue comment at 65536 characters. Stay under 60000. A
// chunk at the limit is one picture whose link alone is too long.
export function shotComments(repo, items) {
  const chunks = []
  let batch = []
  for (const item of items) {
    if (
      batch.length &&
      shotBody(repo, [...batch, item]).length >= COMMENT_MAX
    ) {
      chunks.push(shotBody(repo, batch))
      batch = []
    }
    batch.push(item)
  }
  if (batch.length) chunks.push(shotBody(repo, batch))
  return chunks
}

function ensureRelease(gh) {
  if (gh.releaseView(RELEASE)) return
  gh.releaseCreate(RELEASE, { title: RELEASE, notes: NOTES, target: "main" })
}

function targetFound(gh, { kind, n }) {
  return Boolean(kind === "pr" ? gh.viewPr(n) : gh.viewIssue(n))
}

export function shot(ctx, { files = [], flags = {} } = {}) {
  const unknown = Object.keys(flags).find((key) => !FLAGS.has(key))
  if (!files.length && !unknown) throw new Error(USAGE)
  let usage = null
  const number = (flag) => {
    try {
      return positive(flags[flag])
    } catch (error) {
      usage ??= error
      return null
    }
  }
  const pr = "--pr" in flags ? number("--pr") : null
  const issue = "--issue" in flags ? number("--issue") : null
  const named = "--pr" in flags || "--issue" in flags
  const here = named
    ? { ok: true, shot: true }
    : { ...taskNow(ctx), shot: true }
  // Bytes first, so a bad picture never reaches git or GitHub.
  const checked = files.map(inspect)
  decided(
    decide("shot", {
      flags,
      missingValue: "--name" in flags && !flags["--name"] ? "--name" : null,
      flag: unknown ? { known: false, name: unknown } : { known: true },
      args:
        "--pr" in flags && "--issue" in flags
          ? { ok: false, shot: true }
          : { ok: true },
      shot: { count: files.length },
      here,
      pictures: checked,
    })
  )
  if (usage) throw usage
  const target = pr
    ? { kind: "pr", n: pr }
    : issue
      ? { kind: "issue", n: issue }
      : { kind: "issue", n: here.n }
  const items = shotAssets(
    checked.map((item) => ({ ...item, file: item.path })),
    { kind: target.kind, n: target.n, name: flags["--name"] }
  )
  const repo = ctx.ports.gh.repo().nameWithOwner
  const bodies = flags["--no-comment"] ? [] : shotComments(repo, items)
  const oversize = bodies.some((body) => body.length >= COMMENT_MAX)
  decided(
    decide("shot-target", {
      pictures: items,
      history: { kind: oversize ? "comment-size" : "complete" },
      issue: {
        n: target.n,
        missing: !targetFound(ctx.ports.gh, target),
        kind: target.kind,
        shot: true,
      },
    })
  )
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
