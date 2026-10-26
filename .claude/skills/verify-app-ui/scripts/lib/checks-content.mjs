// Checks 01 to 13: writing and logic. Sources: Apple writing, feedback; WCAG 3.2.4; NN/g empty states
// and hallucinations; shadcn AI Elements. A heuristic says so in its rule text. A scenario that did not
// reach its state is a FAIL, never a pass.
import { context, list, result } from "./check-util.mjs"
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

export function contentChecks(d) {
  const r = []
  const { allSnaps, labels, has } = context(d)

  const nouns = nounViolations(labels)
  r.push(
    result(
      "01",
      "product-nouns",
      nouns.length === 0,
      nouns.length
        ? `${nouns.length}: ${list(nouns.map((n) => `"${n.label}" (${n.why})`))}`
        : "none",
      "no chrome label calls a product object opportunity, thread, email, document or profile (word list, heuristic; Job is the product word; goal chips such as A first full-time job and the Connect email row and the account menu label are exempt)"
    )
  )

  const holders = {
    home: d.home.composerPlaceholder,
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
      "Home, Thread and the Paper Coach float use one placeholder string"
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

  // 04. Two failures are driven: the api answers 404 with a raw message, and the connection is refused.
  const raw = "User not found."
  const api = errorTexts(d.coachError)
  const net = errorTexts(d.coachNet)
  const rawShown = api.some((t) => showsRawMessage(t, raw))
  const transport = net.some((t) =>
    /failed to fetch|networkerror|typeerror|err_/i.test(t)
  )
  let m4
  if (!api.length || !net.length)
    m4 = `no error appeared after ${!api.length ? "the 404 answer" : "the refused connection"}`
  else if (rawShown) m4 = `404 answer shows the raw api message "${raw}"`
  else if (transport) m4 = `refused connection shows "${net[0].slice(0, 60)}"`
  else
    m4 = `404 answer: "${api[0].slice(0, 50)}"; refused connection: "${net[0].slice(0, 50)}"`
  r.push(
    result(
      "04",
      "coach-error-not-raw",
      api.length > 0 && net.length > 0 && !rawShown && !transport,
      m4,
      "a failed Coach send shows an error, and it is a sentence, never the api's raw message or a transport error (driven twice: 404 USER_NOT_FOUND, then a refused connection; no error shown is a FAIL)"
    )
  )

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

  const yourName = /\bYour name\b/.test(d.cv.text)
  r.push(
    result(
      "06",
      "starter-cv-name",
      d.cv.h1.length > 0 && !yourName,
      `CV title: "${d.cv.h1[0] ?? ""}"; Your name in the CV text: ${yourName}`,
      "the open starter CV does not render Your name as the person's name"
    )
  )

  const claims = metricClaims(
    `${d.pitch.text} ${d.pitch.imgs.map((i) => i.alt).join(" ")}`
  )
  r.push(
    result(
      "07",
      "pitch-starter-no-metric",
      claims.length === 0,
      claims.length ? list([...new Set(claims)]) : "none",
      "Pitch starter text has no percentage, percent figure or add-to-cart claim"
    )
  )

  // Source reads. A control counts only as a JSX label or a quoted string, not a comment or a type name.
  const label = (word) => new RegExp(`>\\s*${word}\\s*<|["'\`]${word}["'\`]`)
  const approve = has(label("Approve"))
  const deny = has(label("Deny"))
  r.push(
    result(
      "08",
      "confirm-before-write",
      approve.length > 0 && deny.length > 0,
      approve.length && deny.length
        ? "Approve and Deny exist"
        : `no Approve (${approve.length}) and Deny (${deny.length}) button label in features/{coach,home,paper,apply,pitch}; the banner says "Coach updated" after the write`,
      "a Coach write shows Deny and Approve before it runs (source read of JSX labels; the scripted Coach never writes, so no write turn is driven)"
    )
  )

  const tools = d.thread.alerts.filter(
    (t) =>
      /\b(Apply|CV|Letter|Proof|Pitch|Opportunit\w*|cards?)\b/.test(t) &&
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

  // 10. The seeded cards are deleted through the api; the board must then be confirmed empty and rendered.
  const ae = d.applyEmpty
  const board = ["Inbox", "Prep", "Sent", "Live", "Closed"].every((w) =>
    ae.stageDots.some((t) => t.includes(w))
  )
  const wells = (ae.text.match(/Drop a (job|opportunity) here/g) ?? []).length
  const confirmed = ae.cards.length === 0 && board
  r.push(
    result(
      "10",
      "empty-board-one-empty-state",
      confirmed && ae.emptyStates === 1,
      confirmed
        ? `after deleting ${ae.deleted?.deleted} cards: 0 cards, ${ae.emptyStates} empty states, ${wells} wells say "Drop a ... here"`
        : `the zero-card board was not reached: ${ae.cards.length} cards, board rendered ${board}`,
      "with every card deleted (through the api) the board shows exactly one empty state (not one per column, not none); a board not confirmed empty is a FAIL"
    )
  )

  const pl = d.paperLoading.text
  const loading = /Loading documents|Loading…|Loading\.\.\./.test(pl)
  const emptyCopy = /No documents yet/i.test(pl)
  r.push(
    result(
      "11",
      "loading-not-empty",
      loading && !emptyCopy,
      `while GET /api/paper is held: loading text ${loading}, empty copy ${emptyCopy}`,
      "a loading list says it is loading (Loading documents, Loading...) and never shows the empty copy"
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
