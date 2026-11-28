const PACKAGE_FILE = /^(?:packages|apps)\/[^/]+\/package\.json$/
const SOURCE_ONLY_CONDITIONS = new Set(["opencv-source", "types"])
const TYPESCRIPT_SOURCE = /\.(?:ts|tsx|mts|cts)$/
const DECLARATION = /\.d\.(?:ts|mts|cts)$/

function runtimeTargets(exportsField) {
  if (typeof exportsField === "string") return [exportsField]
  if (!exportsField || typeof exportsField !== "object") return []
  return Object.entries(exportsField).flatMap(([key, value]) =>
    SOURCE_ONLY_CONDITIONS.has(key) ? [] : runtimeTargets(value)
  )
}

export function detect(source, file) {
  if (!PACKAGE_FILE.test(file)) return []
  const pkg = JSON.parse(source)
  const targets = [
    ...(typeof pkg.main === "string" ? [pkg.main] : []),
    ...runtimeTargets(pkg.exports),
  ]
  return targets
    .filter(
      (target) => TYPESCRIPT_SOURCE.test(target) && !DECLARATION.test(target)
    )
    .map(
      (target) =>
        `${pkg.name} sends plain Node to TypeScript source ${target}, so the built server cannot start; point import at built files and keep source under opencv-source`
    )
}

export function serverPackages(packages, serverName = "api") {
  const byName = new Map(packages.map((entry) => [entry.pkg.name, entry]))
  const seen = new Set()
  const queue = [serverName]
  while (queue.length) {
    const name = queue.shift()
    const entry = byName.get(name)
    if (!entry || seen.has(name)) continue
    seen.add(name)
    for (const dependency of Object.keys(entry.pkg.dependencies ?? {}))
      if (byName.has(dependency)) queue.push(dependency)
  }
  seen.delete(serverName)
  return [...seen].map((name) => byName.get(name))
}
