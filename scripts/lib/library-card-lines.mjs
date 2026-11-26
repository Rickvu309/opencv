const CARD_LINES =
  /function\s+librarySheetLines\s*\([^)]*\)[^{]*\{([\s\S]*?)\n\}/

export const message =
  "A library card's lines must come from the listed Paper's preview, never from its listed body, which is a blank placeholder for every Paper"

export function detect(
  text,
  file = "apps/web/src/features/paper/paper-library-sections.tsx"
) {
  if (!/apps\/web\/src\/features\/paper\//.test(String(file))) return []
  const body = CARD_LINES.exec(text)?.[1]
  if (body === undefined) return []
  return /\.paper\b|paperPlainText/.test(body) ? [message] : []
}
