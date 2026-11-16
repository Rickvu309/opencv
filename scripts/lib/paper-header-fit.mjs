export function detect(text, path) {
  const failures = []
  if (path.endsWith("rich-page-header.pen.css")) {
    for (const rule of text.matchAll(/(?:min-width|flex-basis)\s*:\s*([^;]+)/g))
      if (/\dpx\b/.test(rule[1]) && /\d(?:ch|rem|em)\b/.test(rule[1]))
        failures.push(
          "Paper title minimum mixes fixed pixels with font-relative space"
        )
  }
  if (path.endsWith("rich-page.tsx")) {
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
