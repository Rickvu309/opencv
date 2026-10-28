// Decisions. Each check reads the tour data and returns { id, name, pass, measured, rule }.
// Ids 01 to 30 are the research section 5 check numbers; 31 and up are the app-wide checks the
// signed-in tour adds. A rule says when it is a heuristic. Source reads are named as such.
import { contentChecks } from "./checks-content.mjs"
import { motionChecks } from "./checks-source.mjs"
import {
  brandViolations,
  capturedGlowViews,
  chromeCopy,
  dashViolations,
  exclamationViolations,
  extraGlowPrimaries,
  titleBeforeCompany,
  toggleViolations,
} from "./text-rules.mjs"
import {
  SURFACES,
  context,
  judged,
  list,
  result,
  scanProblem,
  stubSilent,
} from "./check-util.mjs"
import { keyboardPrimaryCheck, primaryButtonCheck } from "./checks-primary.mjs"
import { boardLanes } from "./checks-stages.mjs"

export function runChecks(d, want = () => true) {
  const r = contentChecks(d, want)
  const { screens, allSnaps, labels, has, scan } = context(d)
  r.push(...motionChecks(d, { allSnaps, screens }))

  // Structure.
  const editor = d.cv.editorRect
  const side = d.cv.sidebarRect
  const widest = Boolean(editor) && (!side || editor.w >= side.w)
  const panelClosed = !d.cv.panelRect
  r.push(
    result(
      "15",
      "cv-widest-coach-beside",
      widest && panelClosed,
      editor
        ? `editor ${editor.w}px, sidebar ${side?.w ?? "none"}px, panel ${d.cv.panelRect ? "open" : "closed"}`
        : "no editor region",
      "with the Coach panel closed, the CV editor is the widest region (an open panel is #377)"
    )
  )

  const board = boardLanes(d.apply)
  const hs =
    d.apply.docScroll.sw > d.apply.docScroll.cw || d.apply.hScrollers.length > 0
  r.push(
    judged(
      "16",
      "apply-five-stages-no-hscroll",
      "at 1440x900 Apply shows a lane heading for every stage in JOB_STAGES except closed and does not scroll sideways. Closed stays hidden. The 390 pass skips this property",
      board.missing.length === 0 && !board.hiddenShown && !hs,
      `stages ${list(board.stages ?? [], 5) || "unread"}; missing lanes: ${board.missing.join(" ") || "none"}; Closed visible: ${board.hiddenShown}; horizontal scroll: ${hs ? list(d.apply.hScrollers) || "page" : "none"}`,
      [board.unread]
    )
  )

  r.push(
    result(
      "17",
      "search-key-hint",
      d.coach.searchHasKbd && Boolean(d.palette.dialog),
      `Search button has a kbd: ${d.coach.searchHasKbd}; Ctrl-K opens a dialog: ${Boolean(d.palette.dialog)}`,
      "the Search button shows a key hint and Ctrl-K opens the dialog"
    )
  )

  const coming = d.paper.disabledControls.filter((l) => /coming soon/i.test(l))
  r.push(
    result(
      "18",
      "paper-no-disabled-filter",
      coming.length === 0,
      coming.length ? list(coming) : "none",
      "Paper shows no control marked Coming soon"
    )
  )

  // Visual craft.
  const decor = []
  for (const k of ["coach", "paper", "apply", "pitch", "pitchEdit"]) {
    for (const f of d[k].fills) {
      if (f.lum < 0.1 || (f.chroma >= 0.08 && !f.token))
        decor.push(
          `${k}: ${f.lum < 0.1 ? "dark" : "tinted"} ${f.area}px2 "${f.t}"`
        )
    }
  }
  const light = SURFACES.every((k) => screens[k].bodyBgLum >= 0.85)
  r.push(
    result(
      "19",
      "light-field-sparse-accent",
      light && decor.length === 0,
      `light: ${light}; decorative dark or tinted fills: ${decor.length ? list(decor, 3) : "none"}`,
      "background luminance 0.85+; no large dark or tinted decorative fill (heuristic: 6000px2 and up, non-button, non-token chroma 0.08+ or luminance under 0.1)"
    )
  )

  const sum = (key, f) => allSnaps.reduce((n, s) => n + f(s[key]), 0)
  const cfails = allSnaps.flatMap((s) => s.contrast.fails)
  const ccount = sum("contrast", (x) => x.failCount)
  r.push(
    result(
      "20",
      "text-contrast",
      ccount === 0,
      `${ccount} of ${sum("contrast", (x) => x.checked)} text nodes fail${
        cfails.length
          ? `: ${list(
              cfails.map((f) => `"${f.text}" ${f.ratio}:1 needs ${f.need}`),
              3
            )}`
          : ""
      }`,
      "text is 4.5:1, or 3:1 at 24px (18.66px bold); text over images and gradients, disabled controls, aria-hidden text and svg are skipped"
    )
  )

  const tfail = sum("targets", (x) => x.fail)
  r.push(
    result(
      "21",
      "target-size-24",
      tfail === 0,
      `${tfail} targets under 24px with no spacing exception: ${list(
        allSnaps.flatMap((s) => s.targets.samples),
        3
      )}`,
      "every link and button is 24x24, or a 24px circle on it touches no other target"
    )
  )

  const found22 = d.coach.applyDots !== null
  const dots = (d.coach.applyDots ?? []).filter((x) => !x.text && !x.named)
  r.push(
    result(
      "22",
      "apply-dot-count-or-absent",
      found22 && dots.length === 0,
      !found22
        ? "the Apply nav item was not found"
        : dots.length
          ? `Apply nav has a ${dots[0].w}x${dots[0].h} dot with no count and no accessible name${dots[0].ariaHidden ? " (aria-hidden)" : ""}`
          : "no unnamed dot",
      "the Apply link is found by the name Apply, and its dot is absent or has a count or an accessible name (an aria-hidden dot has none)"
    )
  )

  const shown = board.lanes.filter((l) => l.heading)
  r.push(
    judged(
      "23",
      "stage-word-plus-dot",
      "every stage in JOB_STAGES except closed is a visible lane headed with its own name. Closed is not a heading until Hidden columns",
      board.missing.length === 0 &&
        !board.hiddenShown &&
        board.misnamed.length === 0,
      `${shown.length} lane headings of ${board.stages?.length ?? "an unread number of"} stages; ${list(
        shown.map((l) => l.heading),
        5
      )}${board.misnamed.map((l) => `; ${l.stage} lane headed "${l.heading}"`).join("")}`,
      [board.unread]
    )
  )

  if (want("28")) r.push(primaryButtonCheck(d))

  if (want("29")) {
    const loadingCopy = /Loading documents|Loading…|Loading\.\.\./.exec(
      d.paperLoading.text
    )?.[0]
    const loadingOwn = Boolean(loadingCopy) || d.paperLoading.skeletons > 0
    const emptyCopy = /Start a document/.exec(d.paperEmpty.text)?.[0]
    const rule29 =
      "while the call is held the page shows its own loading copy or a skeleton and no table; with an empty list it shows a different empty sentence (a blank state is a FAIL; the empty list is an api answer, not a deletion)"
    const loadQuiet = stubSilent(d.paperLoading)
    const emptyQuiet = stubSilent(d.paperEmpty)
    const loadOk =
      loadQuiet !== null || (loadingOwn && !d.paperLoading.hasTable)
    const emptyOk =
      emptyQuiet !== null ||
      (Boolean(emptyCopy) && (loadQuiet !== null || emptyCopy !== loadingCopy))
    r.push(
      judged(
        "29",
        "table-not-mounted-while-loading",
        rule29,
        loadOk && emptyOk,
        `loading: ${loadQuiet ? "not judged" : `${loadingCopy ? `"${loadingCopy}"` : d.paperLoading.skeletons ? `${d.paperLoading.skeletons} skeletons` : "no loading copy or skeleton"}, table mounted ${d.paperLoading.hasTable}`}; empty (list answered with none): ${emptyQuiet ? "not judged" : emptyCopy ? `"${emptyCopy.slice(0, 50)}"` : "no empty sentence"}`,
        [
          loadQuiet && `loading part (${loadQuiet})`,
          emptyQuiet && `empty part (${emptyQuiet})`,
        ]
      )
    )
  }

  const undo = d.cv.buttons.some((b) => /^undo$/i.test(b.label))
  const reject =
    [...d.cv.buttons, ...d.cvCoach.buttons].some((b) =>
      /reject|undo this change/i.test(b.label)
    ) || has(/>\s*Reject\s*<|["'`](Reject|Undo this change)["'`]/).length > 0
  const rule30 =
    "the CV toolbar keeps Undo, and a Coach suggestion has its own Reject"
  const why30 = scanProblem(scan)
  r.push(
    judged(
      "30",
      "undo-and-reject",
      rule30,
      undo && (reject || why30 !== null),
      `Undo on the CV toolbar: ${undo}; a Coach Reject control: ${reject}`,
      [!reject && why30 && `Reject source read (${why30})`]
    )
  )

  // App-wide checks the tour adds.
  const h1s = SURFACES.map((k) => `${k}:${screens[k].h1.length}`)
  r.push(
    result(
      "31",
      "one-h1-per-screen",
      SURFACES.every((k) => screens[k].h1.length === 1),
      h1s.join(" "),
      "the start page, Paper, the open CV, Apply and Pitch each have exactly one visible h1"
    )
  )

  r.push(keyboardPrimaryCheck(d))

  const logs = [
    ...new Set(d.logs.map((l) => `${l.kind} ${l.text.slice(0, 90)}`)),
  ]
  r.push(
    result(
      "33",
      "no-console-errors",
      logs.length === 0,
      logs.length ? `${logs.length}: ${list(logs, 2)}` : "none",
      "the signed-in passes (desktop, reduced motion, 390px) log no console error, React warning, uncaught exception or failed load (the mocked scenario pages are not counted)"
    )
  )

  const budget = 2000
  const slow = Object.entries(d.timing).filter(
    ([, ms]) => ms === null || ms > budget
  )
  r.push(
    result(
      "34",
      "first-render-budget",
      slow.length === 0,
      Object.entries(d.timing)
        .map(([k, ms]) => `${k} ${ms ?? "none"}ms`)
        .join(", "),
      `each route renders its content within ${budget}ms of navigation (dev server, warm, one shared 8-core machine)`
    )
  )

  const sp = SURFACES.map((k) => screens[k].spacing)
  const total = sp.reduce((n, s) => n + s.total, 0)
  const off = {}
  for (const s of sp)
    for (const [k, n] of Object.entries(s.off)) off[k] = (off[k] ?? 0) + n
  const offN = Object.values(off).reduce((a, b) => a + b, 0)
  r.push(
    result(
      "35",
      "spacing-scale",
      offN / total <= 0.05,
      `${offN} of ${total} paddings and gaps off the 4px scale (${Math.round((offN / total) * 1000) / 10}%): ${list(
        Object.entries(off)
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `${k} x${n}`),
        4
      )}`,
      "95% or more of padding and gap values are on the 4px scale (multiples of 4 and the half steps 2, 6, 10, 14)"
    )
  )

  if (want("36")) {
    const papers = d.paper.paperCards
    const longPaper = papers.filter((x) => x.titleLines > 2)
    const tall = d.apply.cards.filter((x) => x.titleLines > 2)
    const untitled = d.apply.cards.filter((x) => x.titleLines === null)
    r.push(
      result(
        "36",
        "row-density",
        papers.length > 0 &&
          longPaper.length === 0 &&
          d.apply.cards.length > 0 &&
          untitled.length === 0 &&
          tall.length === 0,
        `Paper cards ${papers.length}, over 2 title lines: ${longPaper.length}${papers.length ? "" : " (no card found)"}; Apply cards over 2 title lines: ${tall.length}${untitled.length ? `; ${untitled.length} cards with no card title element` : ""}${d.apply.cards.length ? "" : "; no cards"}`,
        'no Paper card name and no Apply card title runs past two lines. The Paper library is a card grid since #396, so there are no rows to size. A Paper card is a button named "<name>, <edited>" holding those two texts; an Apply card title is found by its text from the card\'s aria-label, not by tag. No card or no title element is a FAIL'
      )
    )
  }

  const rc = {}
  for (const s of allSnaps)
    for (const [k, n] of Object.entries(s.rawColors)) rc[k] = (rc[k] ?? 0) + n
  r.push(
    result(
      "37",
      "no-raw-colors",
      Object.keys(rc).length === 0,
      Object.keys(rc).length
        ? `${Object.keys(rc).length} colors match no token: ${list(
            Object.entries(rc)
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => `${k} x${n}`),
            3
          )}`
        : "every color is a token",
      "every computed text, fill and border color equals a semantic design token within 6 per channel (12 when translucent); Tailwind palette variables such as --color-red-600 are not tokens; black scrims, SVG fills and gradient stops are not measured here (19 reads gradients); the source test covers raw hex in apps/web/src"
    )
  )

  if (want("38")) {
    const mobileNav = ["Inbox", "Coach", "Jobs", "Paper", "Apply", "Pitch"]
    const ms = Object.entries(d.mobile).map(([k, s]) => {
      const names = mobileNav.map((n) =>
        s.buttons.find(
          (b) =>
            b.label === n &&
            b.x >= 0 &&
            b.x + b.w <= 390 &&
            b.y < 844 &&
            b.w >= 24 &&
            b.h >= 24
        )
      )
      return {
        k,
        overflow: s.docScroll.sw > s.docScroll.cw,
        missing: names.filter((x) => !x).length,
      }
    })
    r.push(
      result(
        "38",
        "mobile-surfaces-reachable",
        ms.every((m) => !m.overflow && m.missing === 0),
        ms
          .map(
            (m) =>
              `${m.k}: ${m.overflow ? "page scrolls sideways" : "fits"}, ${mobileNav.length - m.missing}/${mobileNav.length} surface links in view`
          )
          .join("; "),
        "at 390x844 the drawer is open and Inbox, Coach, Jobs, Paper, Apply and Pitch are in view at 24px or more, and the page does not scroll sideways"
      )
    )
  }

  const settingsSnaps = [
    d.settings,
    d.settingsReduced,
    d.settingsMobile,
  ].filter((snap) => snap && Array.isArray(snap.chrome))
  const checkedLabels = [
    ...new Set([...labels, ...settingsSnaps.flatMap((snap) => snap.chrome)]),
  ]
  const copy = chromeCopy(checkedLabels, [
    ...allSnaps.map((snap) => snap?.docTitle),
    ...settingsSnaps.map((snap) => snap.docTitle),
  ])
  const brand = brandViolations(copy)
  r.push(
    result(
      "39",
      "brand-wordmark",
      brand.length === 0,
      brand.length
        ? list(brand.map((item) => item.label))
        : "chrome spells opencv",
      "chrome spells the brand as the mark plus lowercase opencv, and never OpenCV"
    )
  )

  const glowViews = capturedGlowViews(d)
  const extraGlow = extraGlowPrimaries(glowViews.map((view) => view.count))
  r.push(
    result(
      "40",
      "one-glow-primary",
      extraGlow.length === 0,
      glowViews.map((view) => `${view.name} ${view.count}`).join(", "),
      "each view has at most one glow primary"
    )
  )

  const dashes = dashViolations(copy)
  r.push(
    result(
      "41",
      "no-dash-in-copy",
      dashes.length === 0,
      dashes.length ? list(dashes) : "no em dash or middle dot",
      "chrome copy has no em dash, en dash, or middle dot"
    )
  )

  const toggles = toggleViolations(checkedLabels)
  r.push(
    result(
      "42",
      "toggle-enabled-disabled",
      toggles.length === 0,
      toggles.length ? list(toggles) : "toggles read Enabled or Disabled",
      "a toggle reads Enabled or Disabled, never On, Off, or Connected"
    )
  )

  const titles = titleBeforeCompany(checkedLabels)
  r.push(
    result(
      "43",
      "title-before-company",
      titles.length === 0,
      titles.length ? list(titles) : "job lines lead with the title",
      "a job line leads with the title, then the company"
    )
  )

  const bangs = exclamationViolations(checkedLabels)
  r.push(
    result(
      "44",
      "no-exclamation",
      bangs.length === 0,
      bangs.length ? list(bangs) : "no exclamation or Oops",
      "chrome copy has no exclamation mark and does not say Oops"
    )
  )
  return r.sort((a, b) => a.id.localeCompare(b.id))
}
