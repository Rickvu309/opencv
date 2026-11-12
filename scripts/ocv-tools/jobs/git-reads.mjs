import { createHash } from "node:crypto"
import { run } from "./common.mjs"

export const REGULAR_MODES = Object.freeze(["100644", "100755"])
const ABSENT = "000000"
export const HANDLED_STATUSES = Object.freeze({
  A: "added",
  M: "modified",
  D: "deleted",
})
const MODE_NAMES = Object.freeze({
  120000: "a symlink",
  160000: "a submodule",
  "040000": "a directory",
})
const OBJECT_ID = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/
const RAW_META =
  /^:(\d{6}) (\d{6}) ([0-9a-f]{40}(?:[0-9a-f]{24})?) ([0-9a-f]{40}(?:[0-9a-f]{24})?) ([A-Z])(\d*)$/
const TREE_ENTRY =
  /^(\d{6}) (blob|tree|commit) ([0-9a-f]{40}(?:[0-9a-f]{24})?)\t/

const strictUtf8 = new TextDecoder("utf-8", { fatal: true })

export class UnreadableGitOutput extends Error {
  constructor(message) {
    super(message)
    this.name = "UnreadableGitOutput"
  }
}

const unreadable = (message) => new UnreadableGitOutput(message)

const asBytes = (out) =>
  Buffer.isBuffer(out)
    ? out
    : out instanceof Uint8Array
      ? Buffer.from(out)
      : Buffer.from(String(out ?? ""), "utf8")

export function utf8Path(bytes, what) {
  try {
    return strictUtf8.decode(bytes)
  } catch {
    throw unreadable(
      `${what} has a path that is not UTF-8 (${JSON.stringify(Buffer.from(bytes).toString("latin1"))}); rename it to UTF-8 and commit again`
    )
  }
}

function nulFields(bytes, what) {
  if (!bytes.length) return []
  if (bytes[bytes.length - 1] !== 0)
    throw unreadable(
      `${what} ended in the middle of an entry, so the list is partial; run it again`
    )
  const fields = []
  let at = 0
  while (at < bytes.length) {
    const end = bytes.indexOf(0, at)
    fields.push(bytes.subarray(at, end))
    at = end + 1
  }
  return fields
}

export function gitBytes(ctx, top, args, { input, what } = {}) {
  const r = run(ctx, "git", args, { cwd: top, bytes: true, input })
  const label = what ?? `git ${args.slice(0, 2).join(" ")}`
  if (!r.ok)
    throw unreadable(
      `${label} failed, so its output cannot be trusted: ${String(r.err || "no output").slice(0, 300)}`
    )
  return asBytes(r.out)
}

const modeName = (mode) => MODE_NAMES[mode] ?? `file mode ${mode}`

function checkDiffModes(path, status, from, to) {
  const expected = {
    A: [[ABSENT], REGULAR_MODES],
    D: [REGULAR_MODES, [ABSENT]],
    M: [REGULAR_MODES, REGULAR_MODES],
  }[status]
  for (const [mode, allowed] of [
    [from, expected[0]],
    [to, expected[1]],
  ])
    if (!allowed.includes(mode))
      throw unreadable(
        `${path} is ${modeName(mode)} in this change, which the test rules do not handle; turn it back into a regular file, or run pnpm --filter @workspace/guards test and say in the PR why it is safe`
      )
}

export function parseRawDiff(output) {
  const fields = nulFields(asBytes(output), "git diff --raw")
  if (fields.length % 2)
    throw unreadable(
      "git diff --raw gave an entry without its path, so the list is partial; run it again"
    )
  const entries = []
  for (let i = 0; i < fields.length; i += 2) {
    const meta = fields[i].toString("latin1")
    const path = utf8Path(fields[i + 1], "git diff")
    const match = meta.match(RAW_META)
    if (!match)
      throw unreadable(
        `git diff --raw gave an entry the tool cannot read for ${path}: ${JSON.stringify(meta)}`
      )
    const [, from, to, , , status] = match
    if (!HANDLED_STATUSES[status])
      throw unreadable(
        `${path} has git status ${status}${status === "T" ? " (its type changed, for example a file became a symlink)" : status === "U" ? " (unmerged)" : ""}, which the test rules do not handle; resolve it into a plain add, change or delete`
      )
    checkDiffModes(path, status, from, to)
    entries.push({ path, status, from, to })
  }
  return entries
}

export function parseTreeList(output) {
  return nulFields(asBytes(output), "git ls-tree").map((field) => {
    const head = field
      .subarray(0, Math.min(field.length, 90))
      .toString("latin1")
    const match = head.match(TREE_ENTRY)
    if (!match)
      throw unreadable(
        `git ls-tree gave an entry the tool cannot read: ${JSON.stringify(head)}`
      )
    const [whole, mode, type, oid] = match
    return {
      mode,
      type,
      oid,
      path: utf8Path(field.subarray(whole.length), "git ls-tree"),
    }
  })
}

export function blobId(bytes, length = 40) {
  const content = asBytes(bytes)
  return createHash(length === 64 ? "sha256" : "sha1")
    .update(`blob ${content.length}\0`)
    .update(content)
    .digest("hex")
}

export function parseBatch(output, wanted) {
  const bytes = asBytes(output)
  const blobs = new Map()
  let at = 0
  for (const { oid, path } of wanted) {
    const end = bytes.indexOf(10, at)
    if (end < 0)
      throw unreadable(
        `git cat-file --batch stopped before ${path}: ${blobs.size} of ${wanted.length} files were read; run it again`
      )
    const header = bytes.subarray(at, end).toString("latin1").split(" ")
    if (header[0] !== oid)
      throw unreadable(
        `git cat-file --batch answered ${JSON.stringify(header.join(" ").slice(0, 80))} where ${path} (${oid}) was asked for, so the reads are out of step`
      )
    if (header[1] === "missing" || header[1] !== "blob")
      throw unreadable(
        `${path} could not be read from the object store (${header.slice(1).join(" ")}); run git fsck`
      )
    const size = Number(header[2])
    const start = end + 1
    if (
      !/^\d+$/.test(header[2] ?? "") ||
      start + size + 1 > bytes.length ||
      bytes[start + size] !== 10
    )
      throw unreadable(
        `${path} is ${header[2]} bytes by git, but its bytes did not arrive whole; run it again`
      )
    const content = bytes.subarray(start, start + size)
    if (blobId(content, oid.length) !== oid)
      throw unreadable(
        `${path} read back with different bytes than git stores for ${oid}; run it again`
      )
    blobs.set(path, content)
    at = start + size + 1
  }
  if (at !== bytes.length)
    throw unreadable(
      `git cat-file --batch sent ${bytes.length - at} bytes more than the ${wanted.length} files asked for, so the reads are out of step`
    )
  return blobs
}

export function readTextBlobs(
  ctx,
  top,
  entries,
  { mayBeEmpty = () => false } = {}
) {
  if (!entries.length) return new Map()
  for (const entry of entries)
    if (!OBJECT_ID.test(entry.oid))
      throw unreadable(`${entry.path} has no object id the tool can read`)
  const output = gitBytes(ctx, top, ["cat-file", "--batch"], {
    input: entries.map((entry) => `${entry.oid}\n`).join(""),
    what: "git cat-file --batch",
  })
  const texts = new Map()
  for (const [path, content] of parseBatch(output, entries)) {
    if (!content.length && !mayBeEmpty(path))
      throw unreadable(
        `${path} is empty, so the tool cannot read what it imports; delete it or give it a test`
      )
    try {
      texts.set(path, strictUtf8.decode(content))
    } catch {
      throw unreadable(
        `${path} is not UTF-8 text, so the tool cannot read what it imports; save it as UTF-8`
      )
    }
  }
  return texts
}

const INDEX_FLAGS = ["ls-files", "-v", "-z"]

export function hiddenFromStatus(ctx, top) {
  const listed = gitBytes(ctx, top, INDEX_FLAGS, { what: "git ls-files -v" })
  const hidden = []
  for (const entry of listed.toString("utf8").split("\0")) {
    if (!entry) continue
    if (entry[1] !== " ")
      throw new UnreadableGitOutput(
        `git ls-files -v gave an entry the tool cannot read (${JSON.stringify(entry.slice(0, 80))}); run git ls-files -v and look`
      )
    const tag = entry[0]
    if (tag === "S" || (tag >= "a" && tag <= "z"))
      hidden.push({
        file: entry.slice(2),
        flag: tag === "S" || tag === "s" ? "skip-worktree" : "assume-unchanged",
      })
  }
  if (hidden.length)
    throw new UnreadableGitOutput(
      `${hidden[0].file} is marked ${hidden[0].flag}${hidden.length > 1 ? ` (and ${hidden.length - 1} more file(s))` : ""}, so git status cannot show whether the files the tests run on are the commit's files; run git update-index --no-${hidden[0].flag} -- ${hidden[0].file} and check again`
    )
}
