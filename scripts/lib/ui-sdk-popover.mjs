export function partialFonts(source) {
  return /Object\.defineProperty\(\s*document,\s*["']fonts["'],\s*\{[\s\S]*?value:\s*\{\s*ready\s*:/.test(
    source
  )
}

export function fontsWithoutDocument(source) {
  return (
    source.includes("installTestFonts()") &&
    !/if\s*\(\s*typeof document\s*!==\s*["']undefined["']\s*\)\s*(?:\{\s*)?installTestFonts\(\)/.test(
      source
    )
  )
}

export function selectPortalLeavesParent(source) {
  return /<SelectPrimitive\.Portal\s*>/.test(source)
}

export function popoverOnlyShifts(source) {
  return (
    source.includes("@ui-sdk/react/popover") && /\balign=\{align\}/.test(source)
  )
}

export function popoverInheritsCallerStyles(source) {
  return (
    source.includes("@ui-sdk/react/popover") &&
    !/container=\{[^}]*ownerDocument\.body\}/.test(source)
  )
}

export function sdkLayerOverridesKit(source) {
  const layer = source.indexOf("@layer ui-sdk;")
  const tailwind = source.indexOf('@import "tailwindcss"')
  return layer < 0 || tailwind < 0 || layer > tailwind
}

export function fractionalPopoverPosition(source) {
  return (
    source.includes("@ui-sdk/react/popover") &&
    !source.includes("popoverCoordinate(coordinate, view.devicePixelRatio")
  )
}

export function popoverEscapeBubbles(source) {
  return (
    source.includes("@ui-sdk/react/popover") &&
    !/event\.stopPropagation\(\)[\s\S]*?controller\.close\(\{\s*reason: "escape-key"/.test(
      source
    )
  )
}

export function popoverRestoresPriorField(source) {
  return (
    source.includes("@ui-sdk/react/popover") &&
    /return closing \? "trigger" : "auto"/.test(source)
  )
}
