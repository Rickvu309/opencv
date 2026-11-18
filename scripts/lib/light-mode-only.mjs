const DARK_VARIANT = /(?<![\w-])dark:[^\s"'`}),;]+/g
const CUSTOM_VARIANT_DARK = /@custom-variant\s+dark\b/g
const DARK_SELECTOR = /(?<![\w-])\.dark(?![\w-])/g
const PREFERS_DARK = /prefers-color-scheme\s*:\s*dark\b/gi
const CLASSLIST_DARK = /classList\.(?:add|toggle)\(\s*["']dark["']/g
const THEME_PROVIDER = /\bThemeProvider\b/g

export const LIGHT_MODE_HINT =
  "OpenCV is light mode only; remove dark styles, .dark selectors, prefers-color-scheme: dark rules and ThemeProvider"

const lineOf = (source, index) => source.slice(0, index).split("\n").length

function collectMatches(source, fileName, pattern, label, out) {
  for (const match of source.matchAll(pattern)) {
    out.push(
      `${fileName}:${lineOf(source, match.index)}: ${match[0]} (${label}); ${LIGHT_MODE_HINT}`
    )
  }
}

export function darkStyleProblems(source, fileName = "file.tsx") {
  if (fileName === "apps/web/public/favicon.svg") return []
  const problems = []
  collectMatches(source, fileName, DARK_VARIANT, "dark: variant", problems)
  collectMatches(
    source,
    fileName,
    CUSTOM_VARIANT_DARK,
    "@custom-variant dark",
    problems
  )
  if (fileName.endsWith(".css") || fileName.endsWith(".html")) {
    collectMatches(source, fileName, DARK_SELECTOR, ".dark selector", problems)
  }
  collectMatches(
    source,
    fileName,
    PREFERS_DARK,
    "prefers-color-scheme: dark",
    problems
  )
  collectMatches(
    source,
    fileName,
    CLASSLIST_DARK,
    "dark class toggle",
    problems
  )
  collectMatches(source, fileName, THEME_PROVIDER, "ThemeProvider", problems)
  return [...new Set(problems)]
}
