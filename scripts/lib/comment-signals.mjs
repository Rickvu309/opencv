import { readFileSync } from "node:fs"
import path from "node:path"
import { root, findCssComments, findSourceComments } from "../no-comments.mjs"

export const PENDING_FILE = "scripts/comment-hatches.pending.json"

export const OWN_FILES = [
  "scripts/lib/comment-signals.mjs",
  "scripts/comment-signals.test.mjs",
]

export const COMMENT_READERS = [
  "scripts/no-comments.mjs",
  "scripts/no-comments.test.mjs",
  "scripts/lib/strip-comments.mjs",
  "scripts/ds-codemod.test.mjs",
]

export const MARKERS = [
  {
    id: "rejected-ok:",
    inComment: /rejected-ok:/,
    inCode: /rejected-ok/,
    readerFollowsWriters: true,
  },
  {
    id: "Documented exception",
    inComment: /Documented exception:/,
    inCode: /Documented exception/,
    readerFollowsWriters: true,
  },
  {
    id: "commented-allowlist",
    inCode: /requireCommentedAllowlist|\/\/\[\^/,
    readerFollowsWriters: false,
  },
  {
    id: "eslint-ok",
    inComment: /\beslint-ok\b/,
    inCode: /\beslint-ok\b/,
    readerFollowsWriters: false,
  },
  {
    id: "lint-ok",
    inComment: /\blint-ok\b/,
    inCode: /\blint-ok\b/,
    readerFollowsWriters: false,
  },
  {
    id: "guard-ok",
    inComment: /\bguard-ok\b/,
    inCode: /\bguard-ok\b/,
    readerFollowsWriters: false,
  },
  {
    id: "allow:",
    inComment: /(?:^|\s)allow:\s/,
    readerFollowsWriters: false,
  },
]

const COMMENT_API =
  /\b(?:getLeadingCommentRanges|getTrailingCommentRanges|forEachLeadingCommentRange|forEachTrailingCommentRange|getCommentRange|findSourceComments|findCssComments|bannedComments)\b/

const OFFICIAL_IMPORT =
  /import\s*\{([^}]*)\}\s*from\s*["'][^"']*no-comments\.mjs["']/g

function reusedReaderNames(code) {
  const names = []
  for (const match of code.matchAll(new RegExp(OFFICIAL_IMPORT.source, "g"))) {
    for (const part of match[1].split(",")) {
      const piece = part.trim().replace(/^type\s+/, "")
      if (!piece) continue
      const sides = piece.split(/\s+as\s+/)
      const imported = sides[0].trim()
      const local = sides[sides.length - 1].trim()
      if (new RegExp(COMMENT_API.source).test(imported)) names.push(local)
    }
  }
  return names
}

function withoutReusedReaders(code) {
  const names = reusedReaderNames(code)
  const hidden = code.replace(
    new RegExp(OFFICIAL_IMPORT.source, "g"),
    (block) => block.replace(/[^\n]/g, " ")
  )
  if (names.length === 0) return hidden
  return hidden.replace(
    new RegExp(`\\b(?:${names.join("|")})\\b`, "g"),
    (hit) => " ".repeat(hit.length)
  )
}

const SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/
const CSS = /\.css$/

export const isGuardFile = (file) =>
  /^scripts\/.*\.(?:[cm]?[jt]s)$/.test(file) ||
  /^apps\/[^/]+\/src\/test\//.test(file) ||
  /^packages\/guards\//.test(file) ||
  /\.(?:test|type-test)\.[cm]?[jt]sx?$/.test(file)

export const isSource = (file) => SOURCE.test(file) || CSS.test(file)

export function readPending(file = path.join(root, PENDING_FILE)) {
  return JSON.parse(readFileSync(file, "utf8"))
}

function commentsOf(file, text) {
  return CSS.test(file) ? findCssComments(text) : findSourceComments(file, text)
}

function withoutComments(file, text) {
  let out = ""
  let cursor = 0
  for (const comment of commentsOf(file, text)) {
    out += text.slice(cursor, comment.pos) + comment.raw.replace(/[^\n]/g, " ")
    cursor = comment.end
  }
  return out + text.slice(cursor)
}

function lineOfMatch(text, regex) {
  const match = regex.exec(text)
  if (!match) return 0
  return text.slice(0, match.index).split("\n").length
}

export function markersIn(text, file) {
  if (OWN_FILES.includes(file) || !isSource(file)) return []
  const found = []
  const mayHold = MARKERS.some(
    (m) => m.inComment?.test(text) || m.inCode?.test(text)
  )
  const mayRead = COMMENT_API.test(text)
  if (!mayHold && !mayRead) return found
  const comments = commentsOf(file, text)
  for (const marker of MARKERS) {
    if (!marker.inComment) continue
    for (const comment of comments) {
      if (marker.inComment.test(comment.raw)) {
        found.push({ marker: marker.id, kind: "comment", line: comment.line })
        break
      }
    }
  }
  if (isGuardFile(file)) {
    const code = withoutComments(file, text)
    for (const marker of MARKERS) {
      if (marker.inCode?.test(code)) {
        found.push({
          marker: marker.id,
          kind: "reader",
          line: lineOfMatch(code, marker.inCode),
        })
      }
    }
    const readers = withoutReusedReaders(code)
    if (!COMMENT_READERS.includes(file) && COMMENT_API.test(readers)) {
      found.push({
        marker: "comment-reader",
        kind: "reader",
        line: lineOfMatch(readers, COMMENT_API),
      })
    }
  }
  return found
}

function allowed(hit, file, pending) {
  if (hit.marker === "comment-reader") return false
  const entries = pending.filter((entry) => entry.marker === hit.marker)
  if (entries.some((entry) => entry.file === file)) return true
  const marker = MARKERS.find((m) => m.id === hit.marker)
  return (
    hit.kind === "reader" && marker.readerFollowsWriters && entries.length > 0
  )
}

export function detect(text, file, pending = readPending()) {
  return markersIn(text, file)
    .filter((hit) => !allowed(hit, file, pending))
    .map((hit) =>
      hit.marker === "comment-reader"
        ? `${file}:${hit.line} reads comments. Only the files in COMMENT_READERS may read them.`
        : hit.kind === "comment"
          ? `${file}:${hit.line} a comment carries "${hit.marker}", which a guard would read as permission. Fix the code and delete the comment.`
          : `${file}:${hit.line} reads "${hit.marker}" from a comment. A guard may only read code. Replace the hatch with a named function or a typed list.`
    )
}

export function staleEntries(files, pending = readPending()) {
  return pending.filter(
    (entry) =>
      !files.some(
        (file) =>
          file.name === entry.file &&
          markersIn(file.text, file.name).some(
            (hit) => hit.marker === entry.marker
          )
      )
  )
}
