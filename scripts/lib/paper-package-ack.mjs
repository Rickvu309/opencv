const WATCHED = new Set([
  "apps/web/src/lib/paper-package-journal.ts",
  "apps/web/src/lib/paper-package-ack.ts",
  "fixture",
])

function problem(detail) {
  return { kind: "package-ack", detail }
}

function bodies(text) {
  const marks = []
  const pattern = /(?:^|\n)(?:export )?function\s/g
  for (const match of text.matchAll(pattern)) marks.push(match.index)
  if (marks.length === 0) return [text]
  return marks.map((start, index) => text.slice(start, marks[index + 1]))
}

function ackAlone(body) {
  const ack = /\b(?:acknowledgement|acknowledgment|receipt)\b/.test(body)
  const saved = /\bsaved\b/.test(body)
  const complete = /\bcomplete\b/.test(body)
  return ack && saved && !complete
}

export function detect(text, file = "source.ts") {
  const name = String(file).replaceAll("\\", "/")
  const watched =
    WATCHED.has(name) ||
    name.endsWith("/paper-package-journal.ts") ||
    name.endsWith("/paper-package-ack.ts")
  if (!watched) return []
  if (bodies(text).some(ackAlone)) return [problem("ack-saved")]
  return []
}
