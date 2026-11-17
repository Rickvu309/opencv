const TEST = /\.test\.[cm]?[jt]sx?$/
const CLONE = /["']clone["']\s*,([\s\S]*?)(?:\]|\))/g
const SAFE =
  /["']--(?:no-hardlinks|no-local)["']|["'](?:https?:\/\/|ssh:\/\/|git@|file:\/\/)/

export function detect(text, file = "fixture.test.mjs") {
  if (!TEST.test(file)) return []
  const source = String(text ?? "")
  return [...source.matchAll(CLONE)]
    .filter((match) => !SAFE.test(match[1]))
    .map((match) => source.slice(0, match.index).split("\n").length)
}
