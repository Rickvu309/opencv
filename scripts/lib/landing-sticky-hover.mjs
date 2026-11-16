const HOVER_CAPABLE = /\(\s*hover\s*:\s*hover\s*\)/

export const LANDING_CSS = /^apps\/web\/src\/features\/landing\/.+\.css$/

export function detect(source) {
  const found = []
  const open = []
  let prelude = ""
  let preludeStart = 0
  let line = 1
  for (const char of source) {
    if (char === "{") {
      const selector = prelude.trim()
      const gated = open.some(
        (block) => block.startsWith("@media") && HOVER_CAPABLE.test(block)
      )
      if (!selector.startsWith("@") && selector.includes(":hover") && !gated)
        found.push({
          line: preludeStart,
          why: `${selector.replace(/\s+/g, " ")} styles :hover outside @media (hover: hover) and (pointer: fine), so a tap on a phone leaves the hover state stuck`,
        })
      open.push(selector)
      prelude = ""
    } else if (char === "}") {
      open.pop()
      prelude = ""
    } else if (char === ";") {
      prelude = ""
    } else {
      if (prelude.trim() === "" && char.trim() !== "") preludeStart = line
      prelude += char
    }
    if (char === "\n") line++
  }
  return found
}
