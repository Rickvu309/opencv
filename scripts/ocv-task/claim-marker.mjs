// The claim record: a machine marker inside an issue comment. Pure, so status, take, save and
// release read the same rules. The single claim comment is edited on every save (the heartbeat).
export const CLAIM_IDLE_MINUTES = 180

const MARKER =
  /<!-- ocv-task (claim|release) agent=(\S+) at=(\S+)(?: branch=(\S+))?(?: reason=(.*?))? -->/

const oneLine = (text) =>
  String(text).replace(/\s+/g, " ").replaceAll("-->", "--").trim()

export const claimMarker = ({ agent, at, branch }) =>
  `<!-- ocv-task claim agent=${agent} at=${at} branch=${branch} -->`

export const releaseMarker = ({ agent, at, reason }) =>
  `<!-- ocv-task release agent=${agent} at=${at} reason=${oneLine(reason)} -->`

export function parseMarker(body) {
  const m = MARKER.exec(String(body ?? ""))
  if (!m) return null
  return { kind: m[1], agent: m[2], at: m[3], branch: m[4], reason: m[5] }
}

// The newest marker decides. state: none, released, live (heartbeat under the idle limit) or idle.
export function holderOf(comments, now = Date.now()) {
  let last = null
  for (const c of comments ?? []) {
    const m = parseMarker(c.body)
    if (m) last = { ...m, id: c.databaseId }
  }
  if (!last) return { state: "none" }
  if (last.kind === "release") return { ...last, state: "released" }
  const at = Date.parse(last.at)
  const idleMinutes = Number.isNaN(at)
    ? Infinity
    : Math.max(0, Math.floor((now - at) / 60000))
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
