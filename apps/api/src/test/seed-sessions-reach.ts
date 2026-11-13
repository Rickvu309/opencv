import { posix } from "node:path"

export const SEED_MODULE = "src/test/seed-sessions.ts"
export const PRODUCTION_ENTRY = "src/index.ts"

const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|\bvi\.mock\(\s*)["'`]([^"'`]+)["'`]/g
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/
const SEED_STEM = /(?:^|\/)seed-sessions(?:\.[cm]?[jt]sx?)?$/

export function importsOf(source: string): string[] {
  return [...String(source).matchAll(SPECIFIER)].map((match) => match[1]!)
}

export function detect(source: string, file: string): string[] {
  if (TEST_FILE.test(file)) return []
  return importsOf(source)
    .filter((spec) => SEED_STEM.test(spec))
    .map(
      (spec) =>
        `${file} imports ${spec}: only test files may import the seeding module, so the production server can never reach it`
    )
}

function resolveRelative(
  from: string,
  spec: string,
  exists: (file: string) => boolean
): string | null {
  if (!spec.startsWith(".")) return null
  const base = posix.normalize(posix.join(posix.dirname(from), spec))
  const stem = base.replace(/\.[cm]?[jt]sx?$/, "")
  return (
    [`${stem}.ts`, `${stem}.tsx`, base, `${base}/index.ts`].find(exists) ?? null
  )
}

export function reachableFrom(
  entry: string,
  read: (file: string) => string | null
): Set<string> {
  const seen = new Set<string>()
  const queue = [entry]
  const exists = (file: string) => read(file) !== null
  while (queue.length) {
    const file = queue.shift()!
    if (seen.has(file)) continue
    const source = read(file)
    if (source === null) continue
    seen.add(file)
    for (const spec of importsOf(source)) {
      const target = resolveRelative(file, spec, exists)
      if (target && !seen.has(target)) queue.push(target)
    }
  }
  return seen
}
