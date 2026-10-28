// Checks 01 to 13: writing and logic. Sources: Apple writing, feedback; WCAG 3.2.4; NN/g empty states
// and hallucinations; shadcn AI Elements. A heuristic says so in its rule text. A scenario that did not
// reach its state is a FAIL, never a pass. A stubbed call that never fired, or a source folder that is
// missing, leaves only that part unjudged: a found FAIL still FAILs, otherwise the check is STALE.
import {
  context,
  judged,
  list,
  result,
  scanProblem,
  stubSilent,
} from "./check-util.mjs"
import {
  emptyActionLabels,
  hasBasisSentence,
  metricClaims,
  nounViolations,
  otherProductNames,
  showsRawMessage,
} from "./text-rules.mjs"

const NOT_ERRORS = /^Worked for|Listed your|^Free$/
const errorTexts = (snap) => snap.alerts.filter((t) => t && !NOT_ERRORS.test(t))

// 04. Two failures are driven: the api answers 404 with a raw message, and the connection is refused.
export function coachErrorCheck(d) {
  const raw = "User not found."
  const api = errorTexts(d.coachError)
  const net = errorTexts(d.coachNet)
  const rawShown = api.some((t) => showsRawMessage(t, raw))
  const transport = net.some((t) =>
    /failed to fetch|networkerror|typeerror|err_/i.test(t)
  )
  const apiQuiet = stubSilent(d.coachError)
  const netQuiet = stubSilent(d.coachNet)
  const m4 = [
    apiQuiet
      ? "404 answer not judged"
      : !api.length
        ? "no error appeared after the 404 answer"
        : rawShown
          ? `404 answer shows the raw api message "${raw}"`
          : `404 answer: "${api[0].slice(0, 50)}"`,
    netQuiet
      ? "refused connection not judged"
      : !net.length
        ? "no error appeared after the refused connection"
        : transport
          ? `refused connection shows "${net[0].slice(0, 60)}"`
          : `refused connection: "${net[0].slice(0, 50)}"`,
  ].join("; ")
  const rule04 =
    "a failed Coach send shows an error, and it is a sentence, never the api's raw message or a transport error (driven twice: 404 USER_NOT_FOUND, then a refused connection; no error shown is a FAIL)"
  return judged(
    "04",
    "coach-error-not-raw",
    rule04,
    (apiQuiet !== null || (api.length > 0 && !rawShown)) &&
      (netQuiet !== null || (net.length > 0 && !transport)),
    m4,
    [
      apiQuiet && `404 answer (${apiQuiet})`,
      netQuiet && `refused connection (${netQuiet})`,
    ]
  )
}

export function contentChecks(d) {
  const r = []
  const { allSnaps, labels, has, scan } = context(d)

  const nouns = nounViolations(labels)
  r.push(
    result(
      "01",
      "product-nouns",
      nouns.length === 0,
      nouns.length
        ? `${nouns.length}: ${list(nouns.map((n) => `"${n.label}" (${n.why})`))}`
        : "none",
      "chrome may say Job. Opportunity and Thread fail. Email, document and profile stay banned (word list, heuristic; goal chips, the Connect email row, the account menu, the Paper labels, and the Inbox connect sentences are exempt)"
    )
  )

  const holders = {
    coach: d.coach.composerPlaceholder,
    thread: d.thread.composerPlaceholder,
    "paper-coach": d.cvCoach.composerPlaceholder,
  }
  const set = new Set(Object.values(holders))
  r.push(
    result(
      "02",
      "one-composer-placeholder",
      set.size === 1 && !set.has(null),
      Object.entries(holders)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" | "),
      "The Coach page, the Thread and the Paper Coach float use one placeholder string"
    )
  )

  const empties = emptyActionLabels(labels)
  r.push(
    result(
      "03",
      "button-labels-act",
      empties.length === 0,
      empties.length ? list(empties) : "none",
      "no control is labelled Click here, Learn more, OK or similar (a joke label cannot be decided)"
    )
  )

  r.push(coachErrorCheck(d))

  const others = otherProductNames(allSnaps.map((s) => s.text).join(" "))
  r.push(
    result(
      "05",
      "no-other-product-names",
      others.length === 0,
      others.length ? list([...new Set(others)]) : "none",
      "no screen names a social product such as Instagram, TikTok, Snapchat or Facebook (integrations such as GitHub and Gmail are not matched)"
    )
  )

  const chrome = d.cv.chrome ?? []
  const placeholderName = chrome.includes("Name")
  const yourName =
    chrome.includes("Your name") || /\bYour name\b/.test(d.cv.text)
  const title = d.cv.h1[0] ?? ""
  r.push(
    result(
      "06",
      "starter-cv-name",
      placeholderName && !yourName && title !== "Your name",
      `name placeholder Name: ${placeholderName}; title: "${title}"; Your name in the CV text: ${yourName}`,
      "a new CV's name field placeholder is Name, and the title is not Your name"
    )
  )

  const claims = metricClaims(
    `${d.pitch.exposedText ?? d.pitch.text} ${d.pitch.imgs.map((i) => i.alt).join(" ")}`
  )
  r.push(
    result(
      "07",
      "pitch-starter-no-metric",
      claims.length === 0,
      claims.length ? list([...new Set(claims)]) : "none",
      "Pitch coming-soon copy has no percentage, percent figure or add-to-cart claim. Preview text marked aria-hidden is not counted"
    )
  )

  // Source reads. A control counts only as a JSX label or a quoted string, not a comment or a type name.
  const label = (word) => new RegExp(`>\\s*${word}\\s*<|["'\`]${word}["'\`]`)
  const approve = has(label("Approve"))
  const deny = has(label("Deny"))
  const rule08 =
    "a Coach write shows Deny and Approve before it runs (source read of JSX labels; the scripted Coach never writes, so no write turn is driven)"
  const src08 = scanProblem(scan)
  r.push(
    judged(
      "08",
      "confirm-before-write",
      rule08,
      src08 !== null || (approve.length > 0 && deny.length > 0),
      approve.length && deny.length
        ? "Approve and Deny exist"
        : `no Approve (${approve.length}) and Deny (${deny.length}) button label in the signed-in feature folders; the banner says "Coach updated" after the write`,
      [src08 && `source scan (${src08})`]
    )
  )

  const tools = d.thread.alerts.filter(
    (t) =>
      /\b(Apply|CV|Letter|Proof|Pitch|Job|cards?)\b/.test(t) &&
      !/could not|couldn't|failed|error|unavailable/i.test(t)
  )
  r.push(
    result(
      "09",
      "tool-line-names-object",
      tools.length > 0,
      tools.length
        ? `"${tools[0].slice(0, 80)}"`
        : `status lines: ${list(d.thread.alerts) || "none"}`,
      "a Coach step shows a line that names the object it touched (case-sensitive noun in a status line that is not an error; driven with the scripted read turn, not a write)"
    )
  )

  // 10. Jobs are deleted through the api. The empty board is one empty state, with no Closed header.
  const ae = d.applyEmpty
  const closedHeader = (ae.headingsText ?? []).some((t) => t === "Closed")
  const wells = (ae.text.match(/Drop a (job|opportunity) here/g) ?? []).length
  const confirmed = ae.cards.length === 0 && !closedHeader && wells === 0
  r.push(
    result(
      "10",
      "empty-board-one-empty-state",
      confirmed && ae.emptyStates === 1,
      confirmed
        ? `after deleting ${ae.deleted?.deleted} jobs: 0 cards, ${ae.emptyStates} empty states, Closed header ${closedHeader}`
        : `the zero-job board was not reached: ${ae.cards.length} cards, Closed header ${closedHeader}, ${wells} wells`,
      "with every job deleted the board shows one empty state and no Closed header. Closed stays behind Hidden columns. A board that was not confirmed empty is a FAIL"
    )
  )

  const pl = d.paperLoading.text
  const loading = /Loading documents|Loading…|Loading\.\.\./.test(pl)
  const emptyCopy = /Start a document/i.test(pl)
  const rule11 =
    "a loading list says it is loading (Loading documents, Loading...) and never shows Start a document"
  const silent11 = stubSilent(d.paperLoading)
  r.push(
    judged(
      "11",
      "loading-not-empty",
      rule11,
      silent11 !== null || (loading && !emptyCopy),
      `while GET /api/paper is held: loading text ${loading}, empty copy ${emptyCopy}`,
      [silent11 && `held list (${silent11})`]
    )
  )

  const hit = /Hit Publish/i.test(d.pitch.text)
  const pub = d.pitch.buttons.some((b) => /^Publish$/i.test(b.label))
  r.push(
    result(
      "12",
      "unpublished-banner-has-publish",
      !hit || pub,
      `banner says "Hit Publish": ${hit}; a Publish button is on screen: ${pub}; buttons: ${list(
        d.pitch.buttons.filter((b) => !b.inSidebar).map((b) => b.label),
        6
      )}`,
      "when the unpublished banner names Publish, a Publish button is in the same view"
    )
  )

  // 13. A percentage passes only with a basis phrase in the same card; one outside a card has no card to hold it.
  const cardPct = d.apply.cards.map((c) => ({
    c,
    n: c.text.match(/\d+\s?%/g) ?? [],
  }))
  const bare = cardPct.filter((x) => x.n.length && !hasBasisSentence(x.c.text))
  const inCards = cardPct.reduce((n, x) => n + x.n.length, 0)
  const outside = (d.apply.text.match(/\d+\s?%/g) ?? []).length - inCards
  r.push(
    result(
      "13",
      "fit-not-bare-number",
      bare.length === 0 && outside <= 0,
      bare.length
        ? `${bare.length} cards show a percent with no basis in the card: "${bare[0].c.text.slice(0, 60)}"`
        : outside > 0
          ? `${outside} percent figures on the board outside any card`
          : "no percentage on the board",
      "Apply shows no Fit percentage, or one with a basis phrase (because, based on, from your, matches your) inside the same card"
    )
  )
  return r
}
