function multiset(list) {
  const counts = new Map()
  for (const item of list) counts.set(item, (counts.get(item) ?? 0) + 1)
  return counts
}

export function minus(base, head) {
  const left = multiset(head)
  const gone = []
  for (const item of base) {
    const n = left.get(item) ?? 0
    if (n > 0) left.set(item, n - 1)
    else gone.push(item)
  }
  return gone
}

const listOf = (text) => (text ? text.split("\u0001") : [])
const DISTINCT = (literal) =>
  (literal.startsWith('"') && literal.length > 2) || literal.startsWith("/")

function partsOf(meaning) {
  const [head, subject = "", expected = ""] = meaning.split("|")
  return {
    head,
    subject: subject === "*" ? null : listOf(subject),
    expected: listOf(expected),
  }
}

export function stillChecks(was, now, wide = false) {
  if (was === now) return true
  const a = partsOf(was)
  const b = partsOf(now)
  if (a.head !== b.head || a.subject === null) return false
  const all = [...a.subject, ...a.expected]
  if (wide && !all.some(DISTINCT)) return false
  if (b.subject === null) return minus(all, b.expected).length === 0
  const tighter =
    minus(a.subject, b.subject).length === 0 &&
    minus(a.expected, b.expected).length === 0 &&
    b.subject.length + b.expected.length > all.length
  if (tighter) return true
  return (
    a.expected.some(DISTINCT) &&
    a.expected.length === b.expected.length &&
    minus(a.expected, b.expected).length === 0
  )
}

export const weak = (path, kind, what, subject, extra = {}) => ({
  path,
  kind,
  what,
  subject,
  ...extra,
})

export const RUNS_NOTHING = new Set(["skip", "todo"])
