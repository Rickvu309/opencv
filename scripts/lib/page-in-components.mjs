const SHARED_COMPONENTS = "apps/web/src/components/"

const FULL_PAGE = [
  [/\bmin-h-(?:dvh|screen|svh|lvh)\b/, "fills the screen height"],
  [/<main[\s>]/, "draws the main landmark"],
]

export function pagesInComponents(source, file) {
  if (!file.startsWith(SHARED_COMPONENTS)) return []
  const lines = source.split("\n")
  const found = []
  lines.forEach((text, index) => {
    for (const [pattern, why] of FULL_PAGE)
      if (pattern.test(text))
        found.push({
          line: index + 1,
          message: `${file}:${index + 1} ${why}, so it is a page. Keep a page in apps/web/src/features or apps/web/src/routes, where the phone touch target check reads it. The shared components folder holds parts of a page.`,
        })
  })
  return found
}
