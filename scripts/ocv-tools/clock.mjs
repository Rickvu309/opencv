export function parseHttpDate(text) {
  const m = /^date:\s*(.+)$/im.exec(String(text ?? ""))
  if (!m) return null
  const t = Date.parse(m[1].trim())
  return Number.isNaN(t) ? null : t
}

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
