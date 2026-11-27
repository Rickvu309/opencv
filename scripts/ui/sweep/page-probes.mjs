export function markOpeners() {
  const LAYERS =
    '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[data-slot="coach-panel"],[data-slot="popover-content"]'
  document.addEventListener(
    "pointerdown",
    (event) => {
      const opener = event.target.closest?.(
        'button,a,[role="button"],[role="menuitem"],[role="tab"],[role="combobox"]'
      )
      if (!opener || opener.closest(LAYERS)) return
      for (const old of document.querySelectorAll("[data-sweep-opener]"))
        old.removeAttribute("data-sweep-opener")
      opener.setAttribute("data-sweep-opener", "")
    },
    true
  )
}

export function measureInPage(limit) {
  const SURFACES =
    '[role="dialog"],[role="alertdialog"],[data-sonner-toast],[data-slot="coach-panel"],[data-slot="sheet-content"],[data-slot="popover-content"],[data-slot="dropdown-menu-content"],[role="menu"],[role="listbox"],[role="toolbar"],[data-slot$="-bar"]'
  const CONTROLS =
    'button,a[href],input:not([type="hidden"]):not([type="file"]),select,textarea,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="checkbox"],[role="switch"],[role="radio"],[role="option"],[role="combobox"]'
  const MODAL =
    '[role="dialog"][aria-modal="true"],[role="alertdialog"],dialog[open]'
  const OPEN_MENU =
    '[role="menu"],[role="listbox"],[data-slot="dropdown-menu-content"]'
  const width = innerWidth
  const height = innerHeight
  const visuallyHidden = (style) =>
    /rect\(0px,? 0px,? 0px,? 0px\)/.test(style.clip) ||
    style.clipPath === "inset(50%)"
  const shown = (element) =>
    element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
    !element.closest('[aria-hidden="true"],[inert]') &&
    !visuallyHidden(getComputedStyle(element))
  const kind = (element) => {
    if (element.matches("[data-sonner-toast]")) return "toast"
    if (element.dataset.slot === "coach-panel") return "panel"
    if (element.dataset.slot?.endsWith("-bar")) return "bar"
    if (element.tagName === "BUTTON") return "button"
    if (element.tagName === "A") return "link"
    if (["INPUT", "SELECT", "TEXTAREA"].includes(element.tagName))
      return element.tagName.toLowerCase()
    return (
      element.getAttribute("role") ??
      element.dataset.slot ??
      element.tagName.toLowerCase()
    )
  }
  const name = (element) => {
    const labelledBy = element.getAttribute("aria-labelledby")
    const text =
      element.getAttribute("aria-label") ||
      (labelledBy &&
        document.getElementById(labelledBy.split(" ")[0])?.textContent) ||
      element.querySelector?.('h1,h2,h3,[data-slot$="title"]')?.textContent ||
      element.textContent ||
      element.getAttribute("placeholder") ||
      element.getAttribute("name") ||
      ""
    const short = text.replace(/\s+/g, " ").trim().slice(0, 40)
    return short ? `${kind(element)} "${short}"` : kind(element)
  }
  const pinned = (element) => {
    if (element.closest("dialog[open]")) return true
    for (let at = element; at && at !== document.body; at = at.parentElement)
      if (getComputedStyle(at).position === "fixed") return true
    return false
  }
  const scrolls = (style) => /(auto|scroll)/.test(style)
  const reachable = (element) => {
    for (
      let at = element.parentElement;
      at && at !== document.body;
      at = at.parentElement
    ) {
      const style = getComputedStyle(at)
      if (scrolls(style.overflowY) && at.scrollHeight > at.clientHeight + 1)
        return true
      if (style.position === "fixed") return false
    }
    return false
  }
  const clipOf = (element, x, y) => {
    for (
      let at = element.parentElement;
      at && at !== document.body;
      at = at.parentElement
    ) {
      const style = getComputedStyle(at)
      if (style.overflowX === "visible" && style.overflowY === "visible")
        continue
      const box = at.getBoundingClientRect()
      if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom)
        continue
      return scrolls(style.overflowX) || scrolls(style.overflowY)
        ? "scroll"
        : name(at)
    }
    return null
  }
  const scrollsSideways = (element) => {
    for (
      let at = element.parentElement;
      at && at !== document.body;
      at = at.parentElement
    ) {
      const style = getComputedStyle(at)
      if (/\bpan-y\b/.test(style.touchAction)) return true
      if (scrolls(style.overflowX) && at.scrollWidth > at.clientWidth + 1)
        return true
    }
    return false
  }
  const rect = (element) => {
    const box = element.getBoundingClientRect()
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  }
  const modalOpen = [...document.querySelectorAll(MODAL)].some(shown)
  const boxes = [
    {
      kind: "document",
      name: "page",
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    },
  ]
  for (const element of document.querySelectorAll(SURFACES)) {
    if (!shown(element)) continue
    boxes.push({
      kind: "surface",
      name: name(element),
      ...rect(element),
      pinned: pinned(element),
      reachable: reachable(element),
    })
  }
  let counted = 0
  for (const element of document.querySelectorAll(CONTROLS)) {
    if (counted >= limit) break
    if (!shown(element)) continue
    if (element.matches(':disabled,[aria-disabled="true"]')) continue
    const style = getComputedStyle(element)
    if (style.pointerEvents === "none") continue
    const box = rect(element)
    if (box.width <= 1 || box.height <= 1) continue
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    const isPinned = pinned(element)
    const inside = x >= 0 && x <= width && y >= 0 && y <= height
    const offSide = x < 0 || x > width
    if (!inside && !isPinned && !offSide) continue
    counted += 1
    const clip = inside ? clipOf(element, x, y) : null
    if (clip === "scroll") continue
    let hit = false
    let coveredBy
    let underMenu = false
    if (!inside) coveredBy = "outside the window"
    else if (!clip) {
      const top = document.elementFromPoint(x, y)
      hit = Boolean(
        top &&
        (top === element ||
          element.contains(top) ||
          [...(element.labels ?? [])].some((label) => label.contains(top)))
      )
      if (!hit) {
        const menu = top?.closest(OPEN_MENU) ?? top?.querySelector(OPEN_MENU)
        const menuOpen = [...document.querySelectorAll(OPEN_MENU)].some(shown)
        underMenu = menu
          ? shown(menu)
          : menuOpen && Boolean(top?.closest('[role="presentation"]'))
        coveredBy = top
          ? name(top.closest("[role],[data-slot],button,a,[id]") ?? top)
          : "nothing"
      }
    }
    boxes.push({
      kind: "control",
      name: name(element),
      ...box,
      pinned: isPinned,
      hit,
      underMenu,
      ...(coveredBy ? { coveredBy } : {}),
      ...(clip ? { clippedBy: clip } : {}),
      ...(offSide
        ? { sideways: scrollsSideways(element) ? "scrolls" : "stuck" }
        : {}),
      inModal: Boolean(
        element.closest('[role="dialog"],[role="alertdialog"],dialog')
      ),
      inline:
        style.display === "inline" ||
        Boolean(element.closest("p") && element.tagName === "A"),
      textEntry: element.matches(
        'textarea,input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"])'
      ),
    })
  }
  return { boxes, modalOpen }
}

export function openLayer() {
  const LAYERS =
    '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[data-slot="popover-content"]'
  const layers = [...document.querySelectorAll(LAYERS)].filter((element) =>
    element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  )
  const opener = document.querySelector("[data-sweep-opener]")
  const describe = (element) => {
    const text = (
      element.getAttribute("aria-label") ||
      element.textContent ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40)
    const role = element.getAttribute("role") ?? element.tagName.toLowerCase()
    return text ? `${role} "${text}"` : role
  }
  const focused = document.activeElement
  return {
    count: layers.length,
    layer: layers.length ? describe(layers[layers.length - 1]) : null,
    modal: layers.some((element) =>
      element.matches('[aria-modal="true"],[role="alertdialog"]')
    ),
    opener: opener?.isConnected ? describe(opener) : null,
    focus:
      !focused || focused === document.body
        ? "the page body"
        : describe(focused),
    onOpener: Boolean(
      opener && focused && (opener === focused || opener.contains(focused))
    ),
  }
}

export function twoFrames() {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  )
}
