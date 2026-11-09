import {
  delegateDeclaration,
  type DelegateDeclaration,
  type DelegateMarker,
} from "./operation.js"

export type StoredConnectionResources = { kind: "none" | "jobs" }

export function delegateScope(declaration: DelegateDeclaration) {
  return `${declaration.resource}.${declaration.access === "read" ? "read" : "write"}`
}

export function declarationsFromEntries(entries: readonly unknown[]) {
  const seen = new Set<string>()
  const declarations: DelegateDeclaration[] = []
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || !("delegate" in entry)) continue
    const declaration = delegateDeclaration(
      entry.delegate as DelegateMarker | undefined
    )
    if (!declaration) continue
    const key = `${declaration.resource}:${declaration.access}`
    if (seen.has(key)) continue
    seen.add(key)
    declarations.push(declaration)
  }
  return declarations
}

export function registeredScopesFromDeclarations(
  declarations: readonly DelegateDeclaration[]
) {
  const operationScopes = [
    ...new Set(declarations.map((declaration) => delegateScope(declaration))),
  ].sort()
  return ["connection.status", ...operationScopes, "offline_access"] as const
}

export function resourcesForScopes(
  scopes: readonly string[]
): StoredConnectionResources {
  const jobs = scopes.some(
    (scope) => scope === "job.read" || scope === "job.write"
  )
  return { kind: jobs ? "jobs" : "none" }
}

export function grantedResources(
  resources: StoredConnectionResources
): readonly string[] {
  return resources.kind === "jobs" ? ["job"] : []
}

export function delegateToolAllowed(input: {
  name: string
  delegate?: DelegateMarker
  coach: "auto" | "confirm" | "never" | boolean
  resources: "none" | "jobs"
  reads: "allow"
  writes: "approval"
  scopes: readonly string[]
}) {
  if (input.coach === "never" || input.coach === false) return false
  const declaration = delegateDeclaration(input.delegate)
  if (!declaration) return false
  if (!input.name.startsWith(`${declaration.resource}.`)) return false
  if (
    !grantedResources({ kind: input.resources }).includes(declaration.resource)
  )
    return false
  if (!input.scopes.includes(delegateScope(declaration))) return false
  return declaration.access === "read"
    ? input.reads === "allow"
    : input.writes === "approval"
}

export function proposalGrantAllows(
  resources: StoredConnectionResources,
  scopes: readonly string[],
  writes: string,
  declaration: DelegateDeclaration
) {
  return (
    writes === "approval" &&
    declaration.access === "proposal" &&
    grantedResources(resources).includes(declaration.resource) &&
    scopes.includes(delegateScope(declaration))
  )
}

export function grantCopy(input: {
  resources: StoredConnectionResources
  scopes: readonly string[]
}) {
  const writes = input.scopes.includes("job.write")
  const reads = input.scopes.includes("job.read")
  const share =
    input.resources.kind === "jobs"
      ? writes
        ? "All current and future Jobs · Reversible changes need approval"
        : "All current and future Jobs · This agent cannot change things"
      : "Connection status only · No documents or Jobs shared"
  const readCopy = reads ? "Reads allowed" : null
  const writeCopy = writes
    ? "Writes need approval"
    : "This agent cannot change things"
  return {
    share,
    access: readCopy ? `${readCopy} · ${writeCopy}` : writeCopy,
  }
}

function decoded(value: string) {
  try {
    return decodeURIComponent(value.replaceAll("+", " "))
  } catch {
    return ""
  }
}

function queryPairs(search: string) {
  const pairs = new Map<string, string>()
  for (const part of search.replace(/^\?/, "").split("&")) {
    if (!part) continue
    const split = part.indexOf("=")
    const rawKey = split === -1 ? part : part.slice(0, split)
    const rawValue = split === -1 ? "" : part.slice(split + 1)
    pairs.set(decoded(rawKey), decoded(rawValue))
  }
  return pairs
}

export function scopesFromSearch(search: string) {
  const outer = queryPairs(search)
  const query = outer.get("oauth_query") ?? search.replace(/^\?/, "")
  const scope = queryPairs(query).get("scope") ?? ""
  return scope.split(/\s+/).filter(Boolean)
}
