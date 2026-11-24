const MARKER =
  /<!-- ocv-tools (claim|release) agent=(\S+) at=(\S+)(?: branch=(\S+))?(?: reason=(.*?))? -->/

export const oneLine = (text) =>
  String(text)
    .replace(/\s+/g, " ")
    .replaceAll("<!--", "<!-")
    .replaceAll("-->", "--")
    .trim()

export const claimMarker = ({ agent, at, branch }) =>
  `<!-- ocv-tools claim agent=${agent} at=${at} branch=${branch} -->`

export function parseMarker(body) {
  const m = MARKER.exec(String(body ?? ""))
  if (!m) return null
  return { kind: m[1], agent: m[2], at: m[3], branch: m[4], reason: m[5] }
}

export function holderOf(comments) {
  let last = null
  for (const c of comments ?? []) {
    const m = parseMarker(c.body)
    if (m)
      last = {
        ...m,
        id: c.databaseId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }
  }
  if (!last) return { state: "none" }
  return { ...last, state: last.kind === "release" ? "released" : "live" }
}
