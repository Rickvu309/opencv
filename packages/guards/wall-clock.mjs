const CLOCK_APIS =
  /(?:setTimeout|setInterval|Date\.now|performance\.now)|timers\/promises/

export function wallClockUses(source) {
  const found = []
  source.split("\n").forEach((line, index) => {
    const match = CLOCK_APIS.exec(line)
    if (match) found.push({ line: index + 1, use: match[0] })
  })
  if (/\btimeoutMs\b/.test(source) && !/\btimers\b/.test(source))
    found.push({ line: 0, use: "timeoutMs without injected timers" })
  return found
}
