const RULE = /([^{};]+)\{([^{}]*)\}/g

export const CENTRED_GRID_HINT =
  "a centred grid with no column template sizes its one auto column to the widest child, so max-width: 100% inside it can run past a phone window; add grid-template-columns: minmax(0, 1fr)"

const lineOf = (source, index) => source.slice(0, index).split("\n").length

export function detect(source, fileName = "file.css") {
  const hits = []
  for (const match of source.matchAll(RULE)) {
    const body = match[2]
    if (!/(?:^|;|\s)display:\s*grid\b/.test(body)) continue
    if (!/justify-items:\s*center\b/.test(body)) continue
    if (/grid-template(?:-columns)?:/.test(body)) continue
    const selector = match[1].trim()
    hits.push(
      `${fileName}:${lineOf(source, match.index + match[0].indexOf(selector))} ${selector}: ${CENTRED_GRID_HINT}`
    )
  }
  return hits
}
