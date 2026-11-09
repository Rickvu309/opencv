const WATCHED = new Set([
  "apps/api/src/paper/package-render-map.ts",
  "apps/api/src/paper/package-diagnostics.ts",
  "fixture",
])

function problem(detail) {
  return { kind: "render-map", detail }
}

export function detect(text, file = "source.ts") {
  const name = String(file).replaceAll("\\", "/")
  const watched =
    WATCHED.has(name) ||
    name.endsWith("/package-render-map.ts") ||
    name.endsWith("/package-diagnostics.ts")
  if (!watched) return []
  const problems = []
  if (/\b(?:offset|outlineOffset)\s*:/.test(text))
    problems.push(problem("offset"))
  if (/\b(?:message|label|warning|sentence)\s*:/.test(text))
    problems.push(problem("ui-string"))
  const listed = new Set()
  for (const block of text.matchAll(/targets\s*:\s*\[([^\]]*)\]/g)) {
    for (const id of block[1].matchAll(/t_[a-f0-9]{64}/g)) listed.add(id[0])
  }
  for (const use of text.matchAll(/targetId\s*:\s*["'](t_[a-f0-9]{64})["']/g)) {
    if (!listed.has(use[1])) problems.push(problem("foreign-target"))
  }
  return problems
}
