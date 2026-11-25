import path from "node:path"

const STATEMENT =
  /(?:^|\n)\s*(import|export)\s+(type\s+)?([^;'"]*?)\s*from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']/g

function erased(kind, typeOnly, clause) {
  if (typeOnly) return true
  const names = /^\{([^}]*)\}$/s.exec(clause.trim())
  if (!names) return kind === "export" && clause.trim() === ""
  const parts = names[1]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length > 0 && parts.every((part) => part.startsWith("type "))
}

export function runtimeImports(source) {
  const found = []
  for (const match of String(source).matchAll(STATEMENT)) {
    if (match[5]) {
      found.push(match[5])
      continue
    }
    if (!erased(match[1], Boolean(match[2]), match[3])) found.push(match[4])
  }
  return found
}

function resolveRelative(from, specifier, has) {
  const joined = path.posix.normalize(
    path.posix.join(path.posix.dirname(from), specifier)
  )
  const candidates = [
    joined.replace(/\.js$/, ".ts"),
    joined.replace(/\.js$/, ".tsx"),
    joined,
    `${joined}.ts`,
    `${joined}/index.ts`,
  ]
  return candidates.find((candidate) => has(candidate)) ?? null
}

export function detect(entry, read) {
  const hits = []
  const seen = new Set()
  const queue = [entry]
  const has = (file) => read(file) !== null
  while (queue.length) {
    const file = queue.shift()
    if (seen.has(file)) continue
    seen.add(file)
    const source = read(file)
    if (source === null) continue
    for (const specifier of runtimeImports(source)) {
      if (specifier.startsWith("@workspace/"))
        hits.push(
          `${file} loads ${specifier} at runtime while the test global setup starts, where only built packages resolve; import it as a type or move the value out of the setup's import chain`
        )
      else if (specifier.startsWith(".")) {
        const next = resolveRelative(file, specifier, has)
        if (next) queue.push(next)
      }
    }
  }
  return hits
}
