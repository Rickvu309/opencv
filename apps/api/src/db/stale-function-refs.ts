const SCHEMA_REF = /"?opencv_app"?\s*\.\s*"?([a-z_][a-z0-9_]*)"?/g

export type StoredFunction = { name: string; source: string }

export function staleFunctionRefs(
  functions: StoredFunction[],
  relations: Iterable<string>
) {
  const known = new Set(relations)
  const stale: string[] = []
  for (const fn of functions)
    for (const [, name] of fn.source.matchAll(SCHEMA_REF))
      if (!known.has(name)) stale.push(`${fn.name} reads opencv_app.${name}`)
  return [...new Set(stale)]
}
