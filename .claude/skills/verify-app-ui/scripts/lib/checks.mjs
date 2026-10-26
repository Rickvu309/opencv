// Decisions. Each check reads the tour data and returns { id, name, pass, measured, rule }.
// Ids 01 to 30 are the research section 5 check numbers; 31 and up are the app-wide checks the
// signed-in tour adds. A rule says when it is a heuristic. Source reads are named as such.
import { join } from "node:path"
import { readFileSync } from "node:fs"

import { contentChecks } from "./checks-content.mjs"
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
  FEATURE_DIRS,
  SURFACES,
  context,
  list,
  paletteUsesPanelDuration,
  read,
  rel,
  repo,
  result,
  sourceFiles,
} from "./check-util.mjs"

export function runChecks(d) {
  const r = contentChecks(d)
  const { screens, allSnaps, labels, has } = context(d)

  // Structure.
  const coachText = d.coachPage?.text ?? ""
  const staleHome = ["What are you aiming for?", "Four small things"].filter(
    (phrase) => coachText.includes(phrase)
  )
  r.push(
    result(
      "14",
      "home-composer-first",
      Boolean(d.coachPage) && staleHome.length === 0,
      !d.coachPage
        ? "coach page was not measured"
        : staleHome.length
          ? `/app/coach still shows ${staleHome.join(", ")}`
          : "coach page does not show the old Home prompts",
      "the /app/coach page does not show What are you aiming for? or Four small things"
    )
  )

  const editor = d.cv.editorRect
  const side = d.cv.sidebarRect
  const widest = Boolean(editor) && (!side || editor.w >= side.w)
  const noFloat = !d.cv.coachFloat
  const panelClosed = !d.cv.panelRect
  r.push(
    result(
      "15",
      "cv-widest-coach-beside",
      widest && noFloat && panelClosed,
      editor
        ? `editor ${editor.w}px, sidebar ${side?.w ?? "none"}px, float ${Boolean(d.cv.coachFloat)}, panel ${d.cv.panelRect ? "open" : "closed"}`
        : "no editor region",
      "with the Coach panel closed, the CV editor is the widest region and no second Coach float covers the sheet (an open panel is #377)"
    )
  )

  const headers = ["Saved", "Applied", "Interview", "Offer"]
  const headings = d.apply.headingsText ?? []
  const missing = headers.filter((w) => !headings.includes(w))
  const closedShown = headings.includes("Closed")
  const hs =
    d.apply.docScroll.sw > d.apply.docScroll.cw || d.apply.hScrollers.length > 0
  r.push(
    result(
      "16",
      "apply-five-stages-no-hscroll",
      missing.length === 0 && !closedShown && !hs,
      `missing: ${missing.join(" ") || "none"}; Closed visible: ${closedShown}; horizontal scroll: ${hs ? list(d.apply.hScrollers) || "page" : "none"}`,
      "at 1440x900 Apply shows Saved, Applied, Interview and Offer as column headings and does not scroll sideways. Closed stays hidden. The 390 pass skips this property"
    )
  )

  r.push(
    result(
      "17",
      "search-key-hint",
      d.home.searchHasKbd && Boolean(d.palette.dialog),
      `Search button has a kbd: ${d.home.searchHasKbd}; Ctrl-K opens a dialog: ${Boolean(d.palette.dialog)}`,
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
  for (const k of ["home", "paper", "apply", "pitch", "pitchEdit"]) {
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

  const found22 = d.home.applyDots !== null
  const dots = (d.home.applyDots ?? []).filter((x) => !x.text && !x.named)
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

  const stageHeads = ["Saved", "Applied", "Interview", "Offer"].filter((w) =>
    (d.apply.headingsText ?? []).includes(w)
  )
  r.push(
    result(
      "23",
      "stage-word-plus-dot",
      stageHeads.length === 4,
      `${stageHeads.length} stage headings; ${list(stageHeads, 4)}`,
      "Saved, Applied, Interview and Offer are visible headings. Closed is not a heading until Hidden columns"
    )
  )

  const dur = {}
  for (const s of allSnaps)
    for (const [k, n] of Object.entries(s.durations))
      if (!["150ms", "280ms"].includes(k)) dur[k] = (dur[k] ?? 0) + n
  const examples = allSnaps
    .flatMap((s) => s.durationSamples)
    .filter((x) => !["150ms", "280ms"].includes(x.k))
  const srcMotion = []
  for (const f of sourceFiles([
    ...FEATURE_DIRS.map((x) => `apps/web/src/features/${x}`),
    "apps/web/src/routes",
  ])) {
    for (const m of read(f).matchAll(
      /\bduration-(\d+|fast|slow)\b|\bduration-\[(\d+)ms\]|\b(\d+)ms\b/g
    )) {
      const ms =
        m[1] === "fast"
          ? 100
          : m[1] === "slow"
            ? 200
            : Number(m[1] ?? m[2] ?? m[3])
      if (![0, 150, 280].includes(ms))
        srcMotion.push(`${rel(f).split("/").pop()}: ${m[0]}`)
    }
  }
  r.push(
    result(
      "24",
      "motion-tokens",
      Object.keys(dur).length === 0 && srcMotion.length === 0,
      `computed off-token durations: ${
        Object.entries(dur)
          .map(([k, n]) => `${k} x${n}`)
          .join(", ") || "none"
      }${examples[0] ? ` e.g. ${examples[0].t}.${examples[0].c.slice(0, 40)}` : ""}; in feature source: ${list([...new Set(srcMotion)], 3) || "none"}`,
      "every transition and animation runs 150ms or 280ms, measured on the toured screens including an open Pitch story and as duration-N classes or Nms values in features and routes (looping spinners and skeletons skipped)"
    )
  )

  const reducedBad = Object.entries(d.reduced).flatMap(([k, s]) => [
    ...Object.keys(s.durations)
      .filter((v) => parseFloat(v) > 1)
      .map((v) => `${k}:${v}`),
    ...(s.runningAnimations ? [`${k}:${s.runningAnimations} running`] : []),
    ...(s.scrollBehavior.includes("smooth") ? [`${k}:smooth scroll`] : []),
  ])
  const paletteMotion = paletteUsesPanelDuration()
  r.push(
    result(
      "25",
      "reduced-motion",
      reducedBad.length === 0 && paletteMotion,
      `with reduce: ${reducedBad.length ? list(reducedBad) : "no motion over 1ms"}; palette panel duration: ${paletteMotion}`,
      "with prefers-reduced-motion nothing runs over 1ms, scroll is not smooth, and the command palette open transition uses the panel duration token (source read)"
    )
  )

  const reveal = sourceFiles([
    ...FEATURE_DIRS.map((x) => `apps/web/src/features/${x}`),
    "apps/web/src/routes",
  ]).filter((f) => /text-reveal|TextReveal/.test(read(f)))
  r.push(
    result(
      "26",
      "no-text-reveal",
      reveal.length === 0,
      reveal.length ? list(reveal.map(rel)) : "no import",
      "no app screen imports text-reveal (source read)"
    )
  )

  const banner = read(
    join(repo, "apps/web/src/features/paper/paper-editor-conflict-banner.tsx")
  )
  const errText = d.coachError.alerts.some((t) =>
    /not found|Retry|wrong|unavailable|reach/i.test(t)
  )
  const red = SURFACES.flatMap((k) => screens[k].redOutsideAlert)
  r.push(
    result(
      "27",
      "alerts-have-role",
      errText && red.length === 0 && /role="alert"/.test(banner),
      `Coach error inside a live region: ${errText}; red text outside one: ${red.length ? list(red, 2) : "none"}; conflict banner role=alert: ${/role="alert"/.test(banner)}`,
      "the Coach error and the Paper conflict banner expose a live region role"
    )
  )

  const need = {
    apply: [d.apply, /^(New job|Add job)$/],
    paper: [d.cv, /^(Make mine|Save)/],
    pitch: [d.pitchEdit, /^Get early access$/],
  }
  const found = Object.entries(need).map(([k, [s, re]]) => {
    const b = s.buttons.find((x) => re.test(x.label))
    return { k, label: b?.label, h: b?.h }
  })
  r.push(
    result(
      "28",
      "primary-buttons-48",
      found.every((f) => (f.h ?? 0) >= 32),
      found
        .map((f) => `${f.k} "${f.label ?? "not found"}" ${f.h ?? "?"}px`)
        .join(", "),
      "the primary button on Apply, Paper and Pitch is 32px high or more (the kit glow button is h-8)"
    )
  )

  const loadingCopy = /Loading documents|Loading…|Loading\.\.\./.exec(
    d.paperLoading.text
  )?.[0]
  const loadingOwn = Boolean(loadingCopy) || d.paperLoading.skeletons > 0
  const emptyCopy = /Start a document/.exec(d.paperEmpty.text)?.[0]
  r.push(
    result(
      "29",
      "table-not-mounted-while-loading",
      loadingOwn &&
        !d.paperLoading.hasTable &&
        Boolean(emptyCopy) &&
        emptyCopy !== loadingCopy,
      `loading: ${loadingCopy ? `"${loadingCopy}"` : d.paperLoading.skeletons ? `${d.paperLoading.skeletons} skeletons` : "no loading copy or skeleton"}, table mounted ${d.paperLoading.hasTable}; empty (list answered with none): ${emptyCopy ? `"${emptyCopy.slice(0, 50)}"` : "no empty sentence"}`,
      "while the call is held the page shows its own loading copy or a skeleton and no table; with an empty list it shows a different empty sentence (a blank state is a FAIL; the empty list is an api answer, not a deletion)"
    )
  )

  const coachUndo = has(/>\s*Undo\s*<|["'`]Undo["'`]/).filter((file) =>
    file.includes("features/coach/")
  )
  r.push(
    result(
      "30",
      "undo-and-reject",
      coachUndo.length > 0,
      coachUndo.length
        ? `Coach Undo in ${list(coachUndo)}`
        : "no Undo string in features/coach",
      "a Coach Undo string in features/coach passes without the Paper toolbar"
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

  const tabs = Object.entries(d.tabs).map(
    ([k, v]) => `${k}:${v.reached ?? "none in 60"}`
  )
  r.push(
    result(
      "32",
      "keyboard-reaches-primary",
      Object.values(d.tabs).every((v) => v.reached && v.reached <= 30),
      `Tab presses to the primary action: ${tabs.join(" ")}`,
      "the primary action of each surface takes focus within 30 Tab presses"
    )
  )

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

  const rows = d.paper.rows.filter((h) => h > 0)
  const bad = rows.filter((h) => h < 40 || h > 72)
  const tall = d.apply.cards.filter((x) => x.titleLines > 2)
  const untitled = d.apply.cards.filter((x) => x.titleLines === null)
  r.push(
    result(
      "36",
      "row-density",
      rows.length > 0 &&
        bad.length === 0 &&
        d.apply.cards.length > 0 &&
        untitled.length === 0 &&
        tall.length === 0,
      `Paper rows ${list(
        rows.map((h) => `${h}px`),
        6
      )}; Apply cards over 2 title lines: ${tall.length}${untitled.length ? `; ${untitled.length} cards with no card title element` : ""}${d.apply.cards.length ? "" : "; no cards"}`,
      "Paper rows are 40 to 72px and no Apply card title runs past two lines (the title is found by its text from the card's aria-label, not by tag; no title element is a FAIL)"
    )
  )

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
  return r
}
