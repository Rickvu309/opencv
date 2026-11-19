const JSX_TEXT = />([^<>{}]+)</g

const RELATIVE_TIME =
  /\b(?:just now|\d+\s*(?:seconds?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?)\s+ago)\b/i

export const FIXED_RELATIVE_TIME_HINT =
  "a relative time written as fixed markup text says the same age whatever the real time is; compute it from the stored timestamp with Intl.RelativeTimeFormat"

const lineOf = (source, index) => source.slice(0, index).split("\n").length

export function detect(source, fileName = "file.tsx") {
  const hits = []
  for (const match of source.matchAll(JSX_TEXT)) {
    const phrase = RELATIVE_TIME.exec(match[1])
    if (!phrase) continue
    hits.push(
      `${fileName}:${lineOf(source, match.index)} "${phrase[0]}": ${FIXED_RELATIVE_TIME_HINT}`
    )
  }
  return hits
}
