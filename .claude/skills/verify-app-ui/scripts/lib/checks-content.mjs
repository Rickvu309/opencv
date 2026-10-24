// Checks 01 to 13: writing and logic. Sources: Apple writing, feedback; WCAG 3.2.4; NN/g empty states
// and hallucinations; shadcn AI Elements. A heuristic says so in its rule text.
import { context, list, result } from "./check-util.mjs"
import {
  emptyActionLabels,
  hasBasisSentence,
  metricClaims,
  nounViolations,
  otherProductNames,
  showsRawMessage,
} from "./text-rules.mjs"

export function contentChecks(d) {
  const r = []
  const { allSnaps, labels, has } = context(d)

  // Writing. Sources: Apple writing "Build language patterns"; WCAG 3.2.4 consistent identification.
  const nouns = nounViolations(
    labels.filter((l) => !/profile and settings|connect email/i.test(l))
  )
  r.push(
    result(
      "01",
      "product-nouns",
      nouns.length === 0,
      nouns.length
        ? `${nouns.length}: ${list(nouns.map((n) => `"${n.label}" (${n.why})`))}`
        : "none",
      "no chrome label calls a product object job, email, document or profile (word list, heuristic)"
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

  const raw = "User not found."
  const shown = showsRawMessage(d.coachError.text, raw)
  r.push(
    result(
      "04",
      "coach-error-not-raw",
      !shown && d.coachError.text.length > 0,
      shown
        ? `the page shows the raw api message "${raw}"`
        : "a mapped sentence",
      "a failed Coach send never shows the api's raw message (driven by answering the send call with 404 USER_NOT_FOUND)"
    )
  )

  const others = otherProductNames(allSnaps.map((s) => s.text).join(" "))
  r.push(
    result(
      "05",
      "no-other-product-names",
      others.length === 0,
      others.length ? list([...new Set(others)]) : "none",
      "no screen names Instagram, TikTok, Snapchat or Facebook"
    )
  )

  const yourName = d.cv.h1.find((t) => /^your name$/i.test(t))
  r.push(
    result(
      "06",
      "starter-cv-name",
      !yourName,
      `CV title: "${d.cv.h1[0] ?? ""}"`,
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
      "Pitch starter text has no percentage and no add-to-cart claim"
    )
  )

  const approve = has(/\bApprove\b/),
    deny = has(/\bDeny\b/)
  r.push(
    result(
      "08",
      "confirm-before-write",
      approve.length > 0 && deny.length > 0,
      approve.length && deny.length
        ? "Approve and Deny exist"
        : `no Approve (${approve.length}) and Deny (${deny.length}) control in features/{coach,home,paper,apply,pitch}; the banner says "Coach updated" after the write`,
      "a Coach write shows Deny and Approve before it runs (source read; the scripted Coach never writes, so no write turn is driven)"
    )
  )

  const tools = d.thread.alerts.filter((t) =>
    /\b(Apply|CV|Letter|Proof|Pitch|Opportunit|card)/i.test(t)
  )
  r.push(
    result(
      "09",
      "tool-line-names-object",
      tools.length > 0,
      tools.length
        ? `"${tools[0].slice(0, 80)}"`
        : `status lines: ${list(d.thread.alerts) || "none"}`,
      "a Coach step shows a line that names the object it touched (driven with the scripted read turn, not a write)"
    )
  )

  const wells = (
    d.applyEmpty.text.match(/Drop a (job|opportunity) here/g) ?? []
  ).length
  r.push(
    result(
      "10",
      "empty-board-one-empty-state",
      wells <= 1,
      `${wells} column wells say "Drop a ... here" with zero cards`,
      "an empty board shows one empty state with one button, not one per column (driven by answering GET /api/apply with an empty list)"
    )
  )

  const loading = /Loading/i.test(d.paperLoading.text),
    emptyCopy = /No documents yet/i.test(d.paperLoading.text)
  r.push(
    result(
      "11",
      "loading-not-empty",
      loading && !emptyCopy,
      `while GET /api/paper is held: loading text ${loading}, empty copy ${emptyCopy}`,
      "a loading list says it is loading and never shows the empty copy"
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

  const pct = d.apply.text.match(/\d+\s?%/g) ?? []
  r.push(
    result(
      "13",
      "fit-not-bare-number",
      pct.length === 0 || hasBasisSentence(d.apply.text),
      pct.length
        ? `percent on the board: ${list(pct)}`
        : "no percentage on the board",
      "Apply shows no Fit percentage, or one with a sentence of basis"
    )
  )

  return r
}
