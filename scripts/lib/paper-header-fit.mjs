export function detect(text, path) {
  const failures = []
  if (path.endsWith("rich-page-header.pen.css")) {
    for (const rule of text.matchAll(/(?:min-width|flex-basis)\s*:\s*([^;]+)/g))
      if (/\dpx\b/.test(rule[1]) && /\d(?:ch|rem|em)\b/.test(rule[1]))
        failures.push(
          "Paper title minimum mixes fixed pixels with font-relative space"
        )
  }
  if (
    path.endsWith("rich-status-detail.ts") &&
    (!text.includes("previous.width !== layout.width") ||
      !text.includes("previous.font !== layout.font") ||
      !/visible:\s*action.resized\s*\?\s*action.clipped/.test(text))
  )
    failures.push(
      "Paper status detail must recheck clipping when layout changes"
    )
  if (path.endsWith("rich-page.tsx")) {
    if (
      /editorError\s*\|\|\s*!\["loading",\s*"saving",\s*"saved"\]\.includes\(status\)/.test(
        text
      )
    )
      failures.push("Paper status detail disappears during offline typing")
    const live = [...text.matchAll(/<span\b[^>]*role="status"[^>]*>/g)]
    if (live.some(([tag]) => /aria-hidden=/.test(tag)))
      failures.push("Paper header live status must stay exposed")
    const detail = text.match(
      /<p\b[^>]*data-slot="paper-status-detail"[^>]*>/
    )?.[0]
    if (
      detail &&
      (!detail.includes('aria-hidden="true"') || /role=/.test(detail))
    )
      failures.push(
        "Paper visible detail must be hidden from assistive technology"
      )
    const actions = text.match(
      /<div className="([^"]+)">\s*<span\s+role="status"/
    )?.[1]
    if (
      actions &&
      (!actions.includes("min-w-0") || /\bshrink-0\b/.test(actions))
    )
      failures.push(
        "Paper status group cannot shrink to keep the menu on screen"
      )
    const status = text.match(
      /<span\s+role="status"[^>]*className="([^"]+)"/
    )?.[1]
    if (status && /\bshrink-0\b/.test(status))
      failures.push("Paper status text cannot shrink beside the menu")
    if (!text.includes('data-slot="paper-status-detail"'))
      failures.push(
        "Paper truncated status has no full message in the page body"
      )
  }
  return failures
}
