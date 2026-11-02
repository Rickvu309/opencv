import {
  COLLAPSED_KEY,
  FRAME,
  rectOf,
  SIDEBAR,
  WIDTH_KEY,
} from "./sidebar-resize-shared.mjs"

const PANEL = "document.querySelector('#app-main').parentElement"
const EXPAND = '[data-slot="sidebar-expand"]'
const PEEK_ZONE = '[data-slot="sidebar-peek-zone"]'
const DOCK = '[data-slot="app-dock"]'
const HEADER = '[data-slot="page-header"]'
const MAX_PEEK_ZONE = 8

export const COLLAPSED_PATHS = ["/inbox", "/paper", "/coach", "/jobs"]

async function open(page, web, path, collapsed) {
  await page.goto(web)
  await page.evaluate(
    `localStorage.removeItem(${JSON.stringify(WIDTH_KEY)}); localStorage.setItem(${JSON.stringify(COLLAPSED_KEY)}, ${JSON.stringify(collapsed ? "1" : "0")})`
  )
  await page.goto(`${web}${path}`)
  await page.waitFor(
    `!!document.querySelector(${JSON.stringify(SIDEBAR)}) && !!document.querySelector('#app-main') && ${path === "/jobs" ? `!!document.querySelector(${JSON.stringify(HEADER)})` : "true"}`,
    20000
  )
  await page.evaluate(
    "document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))"
  )
  await page.sleep(400)
}

const measure = (page) =>
  page.evaluate(`(() => {
    const paint = (el) => { const c = getComputedStyle(el).backgroundColor; return /rgba\\(.*, 0\\)$|transparent/.test(c) ? null : c; };
    const colorAt = (x, y) => { for (const el of document.elementsFromPoint(x, y)) { const c = paint(el); if (c) return c; } return null; };
    const p = ${PANEL}.getBoundingClientRect();
    const dock = document.querySelector(${JSON.stringify(DOCK)}).getBoundingClientRect();
    const zone = document.querySelector(${JSON.stringify(PEEK_ZONE)});
    const z = zone ? zone.getBoundingClientRect() : null;
    const left = p.left, right = innerWidth - p.right, top = p.top;
    const y = innerHeight / 2;
    return {
      left, right, top, dockLeft: dock.left,
      gutterColor: left > 0 ? colorAt(left / 2, y) : null,
      marginColor: right > 0 ? colorAt(innerWidth - right / 2, y) : null,
      topColor: top > 0 ? colorAt(innerWidth / 2, top / 2) : null,
      zone: zone ? { w: z.width, position: getComputedStyle(zone).position, bg: paint(zone) } : null,
    };
  })()`)

export function assertCollapsedInset({ check, tag, m }) {
  check(
    Math.abs(m.left - m.right) <= 1 && Math.abs(m.left - m.top) <= 1,
    `${tag} the panel has one inset on the left, right and top (left ${m.left}, right ${m.right}, top ${m.top})`
  )
  check(
    Math.abs(m.dockLeft - m.left) <= 1,
    `${tag} the dock starts where the panel starts (dock ${m.dockLeft}, panel ${m.left})`
  )
  check(
    m.gutterColor !== null && m.gutterColor === m.marginColor,
    `${tag} no strip: the left gutter is the margin colour (${m.gutterColor} vs ${m.marginColor})`
  )
  check(
    m.zone !== null &&
      m.zone.w <= MAX_PEEK_ZONE &&
      m.zone.position === "absolute" &&
      m.zone.bg === null,
    `${tag} the peek zone is a transparent absolute strip of at most ${MAX_PEEK_ZONE}px (${JSON.stringify(m.zone)})`
  )
}

async function expandIcon({ page, check, tag, capture }) {
  const icon = await page.evaluate(`(() => {
    const b = document.querySelector(${JSON.stringify(EXPAND)});
    const h = document.querySelector(${JSON.stringify(HEADER)});
    if (!b || !h) return null;
    const r = b.getBoundingClientRect(), hr = h.getBoundingClientRect();
    const title = h.querySelector('[data-slot="page-header-title"]').getBoundingClientRect();
    const panel = ${PANEL}.getBoundingClientRect();
    return { label: b.getAttribute('aria-label'), w: r.width, h: r.height, fromPanel: r.left - panel.left, gap: title.left - r.right, dy: (r.top + r.height / 2) - (hr.top + hr.height / 2), svg: b.querySelector('svg')?.getBoundingClientRect().width, color: getComputedStyle(b).color, muted: getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground') };
  })()`)
  check(icon !== null, `${tag} the header shows the expand icon`)
  if (!icon) return
  check(
    icon.label === "Expand sidebar" && icon.w === 28 && icon.h === 28,
    `${tag} the icon is a 28px button named Expand sidebar (${icon.label} ${icon.w}x${icon.h})`
  )
  check(
    icon.svg >= 15 && icon.svg <= 16,
    `${tag} the glyph is 15 to 16px (${icon.svg})`
  )
  check(
    icon.fromPanel >= 8 &&
      icon.fromPanel <= 16 &&
      icon.gap >= 0 &&
      icon.gap <= 24,
    `${tag} the icon sits at the left inset with the title right after it (from panel ${icon.fromPanel}, gap ${icon.gap})`
  )
  check(
    Math.abs(icon.dy) <= 1,
    `${tag} the icon is vertically centred in the header (${icon.dy})`
  )
  const box = await rectOf(page, EXPAND)
  await page.hover(box.x + box.w / 2, box.y + box.h / 2)
  await page.sleep(700)
  const tip = await page.evaluate(`(() => {
    const t = document.querySelector('[data-slot="tooltip-content"]');
    return t ? { text: t.textContent, key: t.querySelector('kbd')?.textContent } : null;
  })()`)
  check(
    tip !== null && tip.key === "[" && tip.text.includes("Expand sidebar"),
    `${tag} the tooltip names the action and shows [ (${JSON.stringify(tip)})`
  )
  await capture(page, "sidebar-collapsed-jobs-icon-tooltip.png")
  await clickIcon(page)
  await page.sleep(500)
  const after = await page.evaluate(`({
    state: document.querySelector(${JSON.stringify(FRAME)}).dataset.state,
    icon: !!document.querySelector(${JSON.stringify(EXPAND)}),
    inSidebar: !!document.activeElement?.closest('[data-slot="sidebar-frame"]'),
    body: document.activeElement === document.body,
  })`)
  check(
    after.state === "open" && !after.icon,
    `${tag} clicking the icon expands the sidebar and removes the icon`
  )
  check(
    after.inSidebar && !after.body,
    `${tag} focus moves into the sidebar after the icon expands it, not the body`
  )
}

async function clickIcon(page) {
  const box = await rectOf(page, EXPAND)
  const x = box.x + box.w / 2
  const y = box.y + box.h / 2
  await page.mouse("mouseMoved", x, y)
  await page.mouse("mousePressed", x, y)
  await page.mouse("mouseReleased", x, y)
}

export async function checkCollapsedLayout({ browser, web, check, capture }) {
  const page = await browser.openPage({
    width: 1440,
    height: 900,
    mobile: false,
    reducedMotion: true,
  })
  try {
    for (const path of COLLAPSED_PATHS) {
      const tag = `1440 collapsed ${path}`
      await open(page, web, path, true)
      assertCollapsedInset({ check, tag, m: await measure(page) })
      await capture(page, `sidebar-collapsed-${path.slice(1)}.png`)
    }

    await open(page, web, "/jobs", true)
    await expandIcon({ page, check, tag: "1440 collapsed /jobs", capture })

    await open(page, web, "/jobs", true)
    await page.evaluate(
      `document.querySelector(${JSON.stringify(EXPAND)}).focus()`
    )
    await page.key("[")
    await page.sleep(500)
    check(
      await page.evaluate(
        `document.querySelector(${JSON.stringify(FRAME)}).dataset.state === 'open'`
      ),
      "1440 collapsed /jobs [ expands the sidebar"
    )
    await page.key("[")
    await page.sleep(500)
    check(
      await page.evaluate(
        `document.activeElement?.matches(${JSON.stringify(EXPAND)})`
      ),
      "1440 expanded /jobs [ collapses and focus lands on the header icon"
    )

    for (const path of ["/jobs", "/inbox"]) {
      await open(page, web, path, false)
      check(
        await page.evaluate(
          `!document.querySelector(${JSON.stringify(EXPAND)}) && document.querySelector(${JSON.stringify(SIDEBAR)})?.getBoundingClientRect().width > 0`
        ),
        `1440 expanded ${path} no expand icon, sidebar open`
      )
    }
    await capture(page, "sidebar-expanded-inbox.png")
  } finally {
    await page.close()
  }

  const phone = await browser.openPage({
    width: 390,
    height: 844,
    mobile: true,
    reducedMotion: true,
  })
  try {
    await open(phone, web, "/jobs", true)
    check(
      await phone.evaluate(
        `!document.querySelector(${JSON.stringify(EXPAND)}) || getComputedStyle(document.querySelector(${JSON.stringify(EXPAND)})).display === 'none'`
      ),
      "390 the expand icon is not shown on a phone"
    )
    check(
      await phone.evaluate(
        `getComputedStyle(${PANEL}).marginLeft === '0px' && ${PANEL}.getBoundingClientRect().left === 0`
      ),
      "390 the phone layout has no left inset"
    )
  } finally {
    await phone.close()
  }
}
