export function partialFonts(source) {
  return /Object\.defineProperty\(\s*document,\s*["']fonts["'],\s*\{[\s\S]*?value:\s*\{\s*ready\s*:/.test(
    source
  )
}

export function selectPortalLeavesParent(source) {
  return /<SelectPrimitive\.Portal\s*>/.test(source)
}
