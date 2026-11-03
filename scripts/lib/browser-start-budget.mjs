const LAUNCH_CALL = /\b(?:launchBrowser|launchChrome)\s*\(/g
const TEST_CALL = /\b(?:test|it)\s*\(/g

const count = (source, pattern) => source.match(pattern)?.length ?? 0

export function launchesPerFile(source) {
  const code = source
    .split("\n")
    .filter((line) => !/^\s*import\b/.test(line))
    .join("\n")
  const callSites = count(code, LAUNCH_CALL)
  if (!/\bbeforeEach\s*\(/.test(code)) return callSites
  return callSites * Math.max(1, count(code, TEST_CALL))
}

export function startBudgetProblem(
  file,
  source,
  { worstCaseStartMs, testTimeoutMs }
) {
  const launches = launchesPerFile(source)
  const worstCaseMs = launches * worstCaseStartMs
  if (worstCaseMs <= testTimeoutMs) return null
  return `${file}: starts Chrome ${launches} times, and a Chrome that never starts takes ${launches} x ${worstCaseStartMs} ms = ${worstCaseMs} ms on CI, over the ${testTimeoutMs} ms test timeout. The runner then kills the file and its start error is never printed. Start one browser in a before hook and close it in after.`
}
