export const ILLUSTRATION = "[data-illustration]"

export function coveredTextProbe({ selector = ILLUSTRATION } = {}) {
  return `(() => {
  const clipsOf = (el) => {
    const boxes = []
    for (let a = el.parentElement; a; a = a.parentElement) {
      const s = getComputedStyle(a)
      if ([s.overflowX, s.overflowY].some((v) => v !== 'visible')) boxes.push(a.getBoundingClientRect())
    }
    boxes.push({ left: 0, top: 0, right: innerWidth, bottom: innerHeight })
    return boxes
  }
  const visible = (rect, boxes) => {
    let { left, top, right, bottom } = rect
    for (const b of boxes) {
      left = Math.max(left, b.left)
      top = Math.max(top, b.top)
      right = Math.min(right, b.right)
      bottom = Math.min(bottom, b.bottom)
    }
    return right - left >= 1 && bottom - top >= 1 ? { left, top, right, bottom } : null
  }
  const label = (el) =>
    el.tagName.toLowerCase() + ' "' + (el.textContent || '').trim().slice(0, 30) + '"'
  const out = { surfaces: 0, texts: 0, clipped: 0, covered: [] }
  for (const surface of document.querySelectorAll(${JSON.stringify(selector)})) {
    out.surfaces += 1
    const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent || '').trim()
      const parent = node.parentElement
      if (!text || !parent) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const boxes = clipsOf(parent)
      const spots = [...range.getClientRects()]
        .map((r) => visible(r, boxes))
        .filter(Boolean)
      out.texts += 1
      if (!spots.length) {
        out.clipped += 1
        continue
      }
      for (const spot of spots) {
        const width = spot.right - spot.left
        const height = spot.bottom - spot.top
        let hitBy = null
        for (const down of [0.15, 0.5, 0.85]) {
          for (const across of [0.1, 0.5, 0.9]) {
            const x = spot.left + width * across
            const y = spot.top + height * down
            const hit = document.elementFromPoint(x, y)
            if (hit && (parent.contains(hit) || hit.contains(parent))) continue
            hitBy = { text: text.slice(0, 40), by: hit ? label(hit) : 'nothing', x: Math.round(x), y: Math.round(y) }
            break
          }
          if (hitBy) break
        }
        if (hitBy) out.covered.push(hitBy)
      }
    }
  }
  return out
})()`
}

export function judgeCoveredText({ tag, result, minTexts = 5 }) {
  const lines = []
  if (result.surfaces === 0)
    lines.push(`${tag}: no [data-illustration] surface on the page`)
  else if (result.texts - result.clipped < minTexts)
    lines.push(
      `${tag}: only ${result.texts - result.clipped} readable texts in the picture, so the check proved nothing`
    )
  for (const c of result.covered)
    lines.push(`${tag}: "${c.text}" is covered by ${c.by} at ${c.x},${c.y}`)
  return lines
}

export function plantCover(probe) {
  return `(() => {
  const surface = document.querySelector(${JSON.stringify(ILLUSTRATION)})
  const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
  let target = null
  for (let n = walker.nextNode(); n && !target; n = walker.nextNode()) {
    const r = document.createRange()
    r.selectNodeContents(n)
    const b = r.getBoundingClientRect()
    if ((n.textContent || '').trim() && b.width > 20 && b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight) target = b
  }
  if (!target) return null
  const card = document.createElement('div')
  card.style.cssText = 'position:fixed;z-index:99999;background:#fff;left:' + target.left + 'px;top:' + target.top + 'px;width:' + target.width + 'px;height:' + target.height + 'px'
  document.body.appendChild(card)
  const result = ${probe}
  card.remove()
  return result
})()`
}

export const badFixture = [
  {
    name: "a picture text covered by another element",
    fails: () =>
      judgeCoveredText({
        tag: "pitch",
        result: {
          surfaces: 1,
          texts: 9,
          clipped: 0,
          covered: [{ text: "Revenue", by: 'div "card"', x: 10, y: 20 }],
        },
      }).length > 0,
  },
  {
    name: "no picture surface on the page",
    fails: () =>
      judgeCoveredText({
        tag: "pitch",
        result: { surfaces: 0, texts: 0, clipped: 0, covered: [] },
      }).length > 0,
  },
  {
    name: "too few readable texts to prove anything",
    fails: () =>
      judgeCoveredText({
        tag: "pitch",
        result: { surfaces: 1, texts: 3, clipped: 1, covered: [] },
      }).length > 0,
  },
]
