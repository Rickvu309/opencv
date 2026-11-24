const FORCE_MAIN = /git branch -f main\b/
const NOT_ON_MAIN = /git branch --show-current\)"\s*!=\s*"main"/

export const SETUP_MAIN_HINT =
  'git refuses to move main while main is checked out, which is every run on a push to main; wrap it in if [[ "$(git branch --show-current)" != "main" ]]'

export function forcedCheckedOutMain(text, file = "action.yml") {
  const lines = String(text).split("\n")
  return lines.flatMap((line, index) => {
    if (!FORCE_MAIN.test(line)) return []
    const before = lines
      .slice(0, index)
      .reverse()
      .find((earlier) => earlier.trim() !== "")
    if (before && NOT_ON_MAIN.test(before)) return []
    return [`${file}:${index + 1}: ${line.trim()}; ${SETUP_MAIN_HINT}`]
  })
}
