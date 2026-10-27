// Runs inside the page. Self-contained: it is serialised with toString(), so it cannot close over anything.
// It only measures and returns JSON. Every decision lives in checks.mjs.
function probe() {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  const rgba = (css) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = "#000"
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b, a / 255]
  }
  const cs = (el) => getComputedStyle(el)
  const shown = (el) =>
    el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim()
  const label = (el) => clean(el.getAttribute("aria-label") || el.textContent)
  const rect = (el) => {
    const r = el.getBoundingClientRect()
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
    }
  }
  const out = { path: location.pathname }
  const all = [...document.body.querySelectorAll("*")].filter(
    (el) =>
      !(el instanceof SVGElement) &&
      !["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)
  )
  const visible = all.filter((el) => {
    if (!shown(el)) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  })
  const root = cs(document.documentElement)
  const bodyBg = rgba(cs(document.body).backgroundColor)

  // Headings and title.
  const h1s = [...document.querySelectorAll("h1")].filter(shown)
  out.h1 = h1s.map((e) => clean(e.textContent))
  out.docTitle = document.title
  out.text = clean(document.body.innerText).slice(0, 12000)

  // Chrome strings: every control name, placeholder, empty-state line and alert, but not user data.
  const chrome = new Set()
  for (const el of visible) {
    const tag = el.tagName
    if (
      tag === "BUTTON" ||
      tag === "A" ||
      ["button", "menuitem", "tab"].includes(el.getAttribute("role") ?? "")
    ) {
      if (el.closest("[data-card-id], tr[data-row], [data-user-content]"))
        continue
      const l = label(el)
      if (l) chrome.add(l)
    }
    if (tag === "INPUT" || tag === "TEXTAREA") {
      if (el.placeholder) chrome.add(el.placeholder)
      const a = el.getAttribute("aria-label")
      if (a) chrome.add(a)
    }
    const dataPlaceholder = el.getAttribute("data-placeholder")
    if (dataPlaceholder) chrome.add(dataPlaceholder)
    if (el.matches('[role="alert"], [role="status"], [data-slot^="empty"]')) {
      chrome.add(clean(el.textContent))
    }
    if (
      typeof el.className === "string" &&
      el.className.includes("chrome-meta")
    ) {
      const meta = clean(el.textContent)
      if (meta) chrome.add(meta)
    }
  }
  out.chrome = [...chrome].filter((s) => s.length < 160)

  // Composer.
  const composer = visible.find(
    (e) => e.tagName === "TEXTAREA" && !e.closest("[data-slot=dialog-content]")
  )
  out.composerPlaceholder = composer ? composer.placeholder : null
  out.composerRect = composer ? rect(composer) : null

  // Controls (labels, boxes) for the primary-button, target-size and keyboard checks.
  const primary = rgba(root.getPropertyValue("--primary").trim() || "#000")
  const near = (a, b, t = 3) =>
    Math.abs(a[0] - b[0]) <= t &&
    Math.abs(a[1] - b[1]) <= t &&
    Math.abs(a[2] - b[2]) <= t
  out.buttons = visible
    .filter(
      (e) =>
        e.tagName === "BUTTON" ||
        e.tagName === "A" ||
        e.getAttribute("role") === "button"
    )
    .map((e) => {
      const bg = rgba(cs(e).backgroundColor)
      return {
        label: label(e).slice(0, 60),
        ...rect(e),
        disabled:
          e.disabled === true || e.getAttribute("aria-disabled") === "true",
        isPrimary: bg[3] > 0.9 && near(bg, primary),
        inSidebar: Boolean(
          e.closest("aside, [data-sidebar], nav[aria-label=Surfaces]")
        ),
      }
    })

  // Motion: durations in effect on every visible element, and loops that run without a trigger.
  const dur = {}
  const slow = []
  for (const el of visible) {
    const s = cs(el)
    for (const prop of ["transitionDuration", "animationDuration"]) {
      if (
        prop === "animationDuration" &&
        (s.animationName === "none" || s.animationIterationCount === "infinite")
      )
        continue
      if (prop === "transitionDuration" && s.transitionProperty === "none")
        continue
      for (const part of s[prop].split(",")) {
        const v = part.trim()
        const ms = v.endsWith("ms") ? parseFloat(v) : parseFloat(v) * 1000
        if (!ms) continue
        const key = `${Math.round(ms * 100) / 100}ms`
        dur[key] = (dur[key] ?? 0) + 1
        if (slow.length < 400)
          slow.push({
            k: key,
            t: el.tagName.toLowerCase(),
            c: (typeof el.className === "string" ? el.className : "").slice(
              0,
              70
            ),
          })
      }
    }
  }
  out.durations = dur
  out.durationSamples = slow
  out.scrollBehavior = [
    ...new Set([root.scrollBehavior, cs(document.body).scrollBehavior]),
  ]
  out.runningAnimations = document
    .getAnimations()
    .filter(
      (a) =>
        a.playState === "running" &&
        a.effect?.getComputedTiming().iterations !== Infinity
    ).length

  // Contrast of text (skips text over images and gradients, disabled controls).
  const bgOf = (el) => {
    const layers = []
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const s = cs(n)
      if (s.backgroundImage !== "none") return null
      const c = rgba(s.backgroundColor)
      if (c[3] > 0) layers.push(c)
      if (c[3] >= 0.999) break
    }
    let base =
      layers.length && layers[layers.length - 1][3] >= 0.999
        ? layers.pop()
        : bodyBg
    for (const c of layers.reverse()) {
      base = [0, 1, 2]
        .map((i) => c[i] * c[3] + base[i] * (1 - c[3]))
        .concat([1])
    }
    return base
  }
  const opacityOf = (el) => {
    let o = 1
    for (let n = el; n; n = n.parentElement) o *= parseFloat(cs(n).opacity)
    return o
  }
  const contrast = { checked: 0, fails: [] }
  const lum = (c) => {
    const f = (v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
  }
  for (const el of visible) {
    const own = [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent.trim()
    )
    if (!own) continue
    if (el.closest(":disabled, [aria-disabled=true], [aria-hidden=true]"))
      continue
    if (el.closest("img, canvas, svg, [data-no-contrast]")) continue
    const s = cs(el)
    const bg = bgOf(el)
    if (!bg) continue
    const fg0 = rgba(s.color)
    const a = fg0[3] * opacityOf(el)
    const fg = [0, 1, 2].map((i) => fg0[i] * a + bg[i] * (1 - a))
    const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x)
    const ratio = (hi + 0.05) / (lo + 0.05)
    const px = parseFloat(s.fontSize)
    const bold = parseInt(s.fontWeight, 10) >= 700
    const need = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5
    contrast.checked++
    if (ratio < need) {
      contrast.fails.push({
        text: clean(el.textContent).slice(0, 40),
        ratio: Math.round(ratio * 100) / 100,
        need,
        px,
      })
    }
  }
  out.contrast = {
    checked: contrast.checked,
    failCount: contrast.fails.length,
    fails: contrast.fails.slice(0, 5),
  }

  // Target size (WCAG 2.5.8): 24x24, or a 24px circle that touches no other target.
  const targetEls = visible.filter(
    (e) =>
      e.matches(
        "a[href], button, [role=button], [role=tab], input:not([type=hidden]), select, textarea"
      ) && !e.matches(":disabled")
  )
  const boxes = targetEls
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ r }) => !(r.right <= 1 || r.bottom <= 1) && r.width > 1)
    .filter(
      ({ e }) =>
        !e.closest("[class*=sr-only]") &&
        !(e.tagName === "A" && cs(e).display === "inline" && e.closest("p, li"))
    )
  const small = boxes.filter(({ r }) => r.width < 24 || r.height < 24)
  const circle = ({ r }) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })
  const touches = (a, b) => {
    const c = circle(a)
    const dx = Math.max(b.r.left - c.x, 0, c.x - b.r.right)
    const dy = Math.max(b.r.top - c.y, 0, c.y - b.r.bottom)
    return Math.hypot(dx, dy) < 12
  }
  const tooSmall = small.filter((a) => {
    const crowded = boxes.some((b) => b !== a && touches(a, b))
    return crowded || a.r.width < 1
  })
  out.targets = {
    count: boxes.length,
    small: small.length,
    fail: tooSmall.length,
    samples: tooSmall
      .slice(0, 5)
      .map(
        ({ e, r }) =>
          `${label(e).slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`
      ),
  }

  // Screen facts used by single checks.
  const sidebar =
    document.querySelector("aside, [data-sidebar]") ??
    document.querySelector("nav[aria-label=Surfaces]")
  const navLinks = [
    ...document.querySelectorAll("nav[aria-label=Surfaces] a, aside a"),
  ]
  const searchItem = [...document.querySelectorAll("button")].find((b) =>
    /^search$/i.test(label(b))
  )
  out.searchHasKbd = Boolean(
    searchItem && searchItem.querySelector("kbd, [data-slot=kbd]")
  )
  const applyItem = navLinks.find((a) => /^apply$/i.test(label(a)))
  out.applyDots = applyItem
    ? [...applyItem.querySelectorAll("*")]
        .filter((n) => {
          if (n.parentElement?.closest("svg")) return false
          const r = n.getBoundingClientRect()
          return (
            (r.width > 0 && r.width <= 12 && r.height <= 12) ||
            (n.getAttribute("aria-hidden") === "true" &&
              n.tagName !== "svg" &&
              n.textContent.trim() === "" &&
              cs(n).backgroundColor !== "rgba(0, 0, 0, 0)")
          )
        })
        .map((n) => ({
          ariaHidden: n.getAttribute("aria-hidden") === "true",
          text: clean(n.textContent),
          named: Boolean(
            n.getAttribute("aria-label") || n.getAttribute("aria-labelledby")
          ),
          ...rect(n),
        }))
    : null
  out.sidebarRect = sidebar ? rect(sidebar) : null
  // The card title is the deepest element inside the card whose text is the title taken from the card's
  // aria-label ("<title>, <company>" or the older "<title> at <company>"). None found means titleLines is null.
  out.cards = [...document.querySelectorAll("[data-card-id]")].map((c) => {
    const aria = c.getAttribute("aria-label") ?? ""
    const wants = []
    const comma = aria.indexOf(", ")
    if (comma > 0) wants.push(aria.slice(0, comma))
    for (let i = aria.indexOf(" at "); i > 0; i = aria.indexOf(" at ", i + 1)) {
      wants.push(aria.slice(0, i))
    }
    let title = null
    for (const want of wants) {
      const hit = [...c.querySelectorAll("*")].filter(
        (e) =>
          clean(e.textContent) === want &&
          ![...e.children].some((k) => clean(k.textContent) === want)
      )[0]
      if (hit) {
        title = hit
        break
      }
    }
    const lh = title ? parseFloat(cs(title).lineHeight) || 20 : 20
    return {
      h: Math.round(c.getBoundingClientRect().height),
      titleLines: title
        ? Math.round(title.getBoundingClientRect().height / lh)
        : null,
      text: clean(c.textContent).slice(0, 300),
    }
  })
  out.skeletons = visible.filter((e) =>
    e.matches('[data-slot="skeleton"], [class*="animate-pulse"]')
  ).length
  out.emptyStates = visible.filter((e) =>
    e.matches('[data-slot="empty"]')
  ).length
  out.rows = [...document.querySelectorAll("tbody tr, [role=row]")]
    .filter(shown)
    .map((r) => Math.round(r.getBoundingClientRect().height))
  out.hasTable = Boolean(
    document.querySelector("table, [role=table], [role=grid], tbody tr")
  )
  out.docScroll = {
    sw: document.scrollingElement.scrollWidth,
    cw: document.scrollingElement.clientWidth,
  }
  out.hScrollers = visible
    .filter(
      (e) =>
        ["auto", "scroll"].includes(cs(e).overflowX) &&
        e.scrollWidth > e.clientWidth + 1 &&
        !e.closest("aside, nav")
    )
    .map((e) => `${e.tagName.toLowerCase()} ${e.scrollWidth}>${e.clientWidth}`)
    .slice(0, 5)
  out.stageDots = visible
    .filter((e) => {
      const r = e.getBoundingClientRect()
      return (
        r.width <= 12 &&
        r.height <= 12 &&
        parseFloat(cs(e).borderTopLeftRadius) >= 4 &&
        rgba(cs(e).backgroundColor)[3] > 0 &&
        !e.closest("aside, nav") &&
        e.parentElement
      )
    })
    .map((e) => clean(e.parentElement.textContent).slice(0, 40))
  out.disabledControls = out.buttons
    .filter((b) => b.disabled || /coming soon/i.test(b.label))
    .map((b) => b.label)
  const alertTexts = [
    ...document.querySelectorAll("[role=alert], [role=status]"),
  ].map((e) => clean(e.textContent))
  out.alerts = alertTexts
  const destructive = rgba(
    root.getPropertyValue("--destructive").trim() || "#f00"
  )
  out.redOutsideAlert = visible
    .filter(
      (el) =>
        [...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent.trim()
        ) &&
        near(rgba(cs(el).color), destructive, 40) &&
        !el.closest("[role=alert], [role=status], [aria-live]")
    )
    .map((el) => clean(el.textContent).slice(0, 60))
    .slice(0, 5)
  out.headingsText = [...document.querySelectorAll("h1,h2,h3")]
    .filter(shown)
    .map((e) => clean(e.textContent))
  const dialog = document.querySelector("[role=dialog]")
  out.dialog = dialog ? clean(dialog.textContent).slice(0, 80) : null
  out.imgs = [...document.querySelectorAll("img")].filter(shown).map((i) => ({
    alt: i.alt,
    w: Math.round(i.getBoundingClientRect().width),
  }))
  const h1 = h1s[0]
  if (h1) {
    out.h1Rect = rect(h1)
    let cv = h1
    for (
      let n = h1.parentElement;
      n && n !== document.body;
      n = n.parentElement
    ) {
      if (n.getBoundingClientRect().width <= 1000) cv = n
      else break
    }
    out.cvRect = rect(cv)
  }
  const editor = document.querySelector("[data-paper-editor]")
  if (editor && shown(editor)) out.editorRect = rect(editor)
  const aside = document.querySelector("aside")
  if (aside && shown(aside)) out.sidebarRect = rect(aside)
  out.coachFloat = Boolean(
    document.querySelector("[data-coach-float], [data-coach-float-pill]")
  )
  if (composer) {
    let panel = null
    for (
      let n = composer.parentElement;
      n && n !== document.body;
      n = n.parentElement
    ) {
      const pos = cs(n).position
      const r = n.getBoundingClientRect()
      if (
        (pos === "fixed" || pos === "absolute") &&
        r.width * r.height < innerWidth * innerHeight * 0.6
      )
        panel = n
    }
    if (!panel && out.h1Rect) {
      // An in-flow side pane: the widest ancestor of the composer that does not hold the h1.
      const main = document.querySelector("main")
      for (
        let n = composer.parentElement;
        n && n !== main && n !== document.body && !n.contains(h1s[0]);
        n = n.parentElement
      ) {
        if (n.getBoundingClientRect().width < innerWidth * 0.6) panel = n
      }
    }
    if (panel) {
      const pr = panel.getBoundingClientRect()
      out.panelRect = rect(panel)
      out.panelPosition = cs(panel).position
      out.underPanel = visible
        .filter(
          (e) =>
            !panel.contains(e) &&
            !e.contains(panel) &&
            !e.closest("aside, nav") &&
            [...e.childNodes].some(
              (n) => n.nodeType === 3 && n.textContent.trim()
            )
        )
        .filter((e) => {
          const r = e.getBoundingClientRect()
          return (
            r.left < pr.right &&
            r.right > pr.left &&
            r.top < pr.bottom &&
            r.bottom > pr.top
          )
        })
        .map((e) => clean(e.textContent).slice(0, 40))
        .slice(0, 6)
    }
  }
  out.glowCount = visible.filter((el) => {
    const cls = typeof el.className === "string" ? el.className : ""
    return (
      /(^|\s)glow(\s|$)/.test(cls) ||
      ((el.tagName === "BUTTON" || el.getAttribute("role") === "button") &&
        cs(el).backgroundImage.includes("radial-gradient"))
    )
  }).length
  out.active = document.activeElement
    ? {
        tag: document.activeElement.tagName,
        label: label(document.activeElement).slice(0, 40),
      }
    : null
  return out
}

export const probeSource = `(${probe.toString()})()`
