// GitHub's clock. Claim leases use comment updatedAt and a Date header from the
// API. A timestamp written by the client, and this machine's Date.now(), are not clocks.
export function parseHttpDate(text) {
  const m = /^date:\s*(.+)$/im.exec(String(text ?? ""))
  if (!m) return null
  const t = Date.parse(m[1].trim())
  return Number.isNaN(t) ? null : t
}

// gh --include prints headers, then a JSON body. REST uses updated_at.
export function parseUpdatedAt(text) {
  const raw = String(text ?? "")
  const start = raw.search(/[{[]/)
  if (start < 0) return null
  try {
    const data = JSON.parse(raw.slice(start))
    const iso = data.updated_at || data.updatedAt
    const t = Date.parse(iso ?? "")
    return Number.isNaN(t) ? null : new Date(t).toISOString()
  } catch {
    return null
  }
}

// The observer's now: the Date header on a cheap authenticated GET.
// Throws when the header is missing or not a timestamp.
export function readServerNow(ctx) {
  const r = ctx.run("gh", ["api", "--include", "/rate_limit"])
  if (!r.ok)
    throw new Error(
      `could not read GitHub server time: ${r.err || r.out}`.slice(0, 400)
    )
  const now = parseHttpDate(r.out)
  if (now == null)
    throw new Error("GitHub Date header missing or not a valid timestamp")
  return now
}
