const SETUP = ".github/actions/setup/action.yml"
const MOVES_MAIN = /^\s*git branch -f main\b/
const LEAVES_BRANCH = /^\s*git checkout --quiet --detach\s*$/

export function runBlocks(text) {
  const lines = String(text).split("\n")
  const blocks = []
  for (let at = 0; at < lines.length; at++) {
    const start = /^(\s*)- run: \|\s*$/.exec(lines[at])
    if (!start) continue
    const body = []
    const indent = start[1].length + 2
    for (at++; at < lines.length; at++) {
      const line = lines[at]
      if (line.trim() && line.length - line.trimStart().length <= indent) break
      body.push(line)
    }
    at--
    blocks.push(body.join("\n"))
  }
  return blocks
}

export function mainMovingBlock(text) {
  return (
    runBlocks(text).find((block) =>
      block.split("\n").some((line) => MOVES_MAIN.test(line))
    ) ?? null
  )
}

export function detect(text, file) {
  if (!String(file).endsWith(SETUP)) return []
  const block = mainMovingBlock(text)
  if (!block) return []
  const lines = block.split("\n")
  const moves = lines.findIndex((line) => MOVES_MAIN.test(line))
  const leaves = lines.findIndex((line) => LEAVES_BRANCH.test(line))
  return leaves !== -1 && leaves < moves
    ? []
    : [
        "setup moves main while main can be the checked-out branch; leave the branch first with git checkout --quiet --detach",
      ]
}
