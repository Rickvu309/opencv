// The claim record: a machine marker inside an issue comment. Pure, so status, take, save and
// release read the same rules. The single claim comment is edited on every save (the heartbeat).
export const CLAIM_IDLE_MINUTES = 180
// GitHub's Date header and a comment's updatedAt can disagree by a few seconds.
// A stamp further ahead than this is untrusted and does not keep a claim live.
export const CLAIM_SKEW_MS = 2 * 60 * 1000

const MARKER =
  /<!-- ocv-tools (claim|release) agent=(\S+) at=(\S+)(?: branch=(\S+))?(?: reason=(.*?))? -->/

const oneLine = (text) =>
  String(text).replace(/\s+/g, " ").replaceAll("-->", "--").trim()

export const claimMarker = ({ agent, at, branch }) =>
  `<!-- ocv-tools claim agent=${agent} at=${at} branch=${branch} -->`

export const releaseMarker = ({ agent, at, reason }) =>
  `<!-- ocv-tools release agent=${agent} at=${at} reason=${oneLine(reason)} -->`

export function parseMarker(body) {
  const m = MARKER.exec(String(body ?? ""))
  if (!m) return null
  return { kind: m[1], agent: m[2], at: m[3], branch: m[4], reason: m[5] }
}

// Lease instant from the comment GitHub stored (updatedAt, else createdAt).
// The marker's at= is text the client wrote. It is not the clock. A stamp
// ahead of server now by more than CLAIM_SKEW_MS is rejected (idle).
export function leaseAt(comment, serverNow) {
  const raw = Date.parse(comment?.updatedAt || comment?.createdAt || "")
  if (Number.isNaN(raw)) return null
  if (typeof serverNow !== "number" || raw > serverNow + CLAIM_SKEW_MS)
    return null
  return raw
}

// The newest marker decides. state: none, released, live (heartbeat under the idle limit) or idle.
// `now` is a GitHub server timestamp (Date header), not the machine clock.
export function holderOf(comments, now) {
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
  if (last.kind === "release") return { ...last, state: "released" }
  const at = leaseAt(last, now)
  const idleMinutes =
    at == null ? Infinity : Math.max(0, Math.floor((now - at) / 60000))
  return {
    ...last,
    idleMinutes,
    state: idleMinutes < CLAIM_IDLE_MINUTES ? "live" : "idle",
  }
}

export function holderLine(h) {
  if (h.state === "none") return "Claim: none"
  if (h.state === "released")
    return `Claim: released by ${h.agent}${h.reason ? ` (${h.reason})` : ""}`
  const idle = Number.isFinite(h.idleMinutes) ? h.idleMinutes : "?"
  return h.state === "live"
    ? `Claim: held by ${h.agent}, last saved ${idle} min ago (taken over after ${CLAIM_IDLE_MINUTES})`
    : `Claim: ${h.agent}, idle ${idle} min, can be taken over`
}
