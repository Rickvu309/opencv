const Y_SCROLL = /^overflow(?:-y)?-(?:auto|scroll)$/
const Y_CLIP = /^overflow(?:-y)?-(?:hidden|clip)$/

function openingTagAround(source, at) {
  const start = source.lastIndexOf("<", at)
  const end = source.indexOf(">", at)
  return start < 0 || end < 0 ? "" : source.slice(start, end + 1)
}

export function detect(source) {
  const at = source.indexOf('id="app-main"')
  if (at < 0) return []
  const tag = openingTagAround(source, at)
  const className = /className="([^"]*)"/.exec(tag)?.[1] ?? ""
  const tokens = className.split(/\s+/).filter(Boolean)
  const lastY = tokens
    .filter((token) => Y_SCROLL.test(token) || Y_CLIP.test(token))
    .at(-1)
  if (lastY && Y_SCROLL.test(lastY)) return []
  const line = source.slice(0, at).split("\n").length
  return [
    {
      line,
      why: lastY
        ? `the shell's main card clips its page with ${lastY}, so a page taller than a short window cannot be scrolled to its end`
        : "the shell's main card does not scroll, so a page taller than a short window cannot be scrolled to its end",
    },
  ]
}
