import {
  delegateDeclaration,
  type DelegateDeclaration,
  type DelegateMarker,
  type DelegateResource,
} from "../operation.js"
import type { ConnectionResources } from "./connections.js"

function delegateScope(declaration: DelegateDeclaration) {
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
): ConnectionResources {
  const jobs = scopes.some(
    (scope) => scope === "job.read" || scope === "job.write"
  )
  const paper = scopes.some(
    (scope) => scope === "paper.read" || scope === "paper.write"
  )
  return {
    kind:
      jobs && paper
        ? "jobs-and-paper"
        : jobs
          ? "jobs"
          : paper
            ? "paper"
            : "none",
  }
}

function grantedResources(
  resources: ConnectionResources
): readonly DelegateResource[] {
  if (resources.kind === "jobs-and-paper") return ["job", "paper"]
  if (resources.kind === "jobs") return ["job"]
  if (resources.kind === "paper") return ["paper"]
  return []
}

export function proposalGrantAllows(
  resources: ConnectionResources,
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
  resources: ConnectionResources
  scopes: readonly string[]
}) {
  const resources = grantedResources(input.resources)
  const writes = resources.some((resource) =>
    input.scopes.includes(`${resource}.write`)
  )
  const reads = resources.some((resource) =>
    input.scopes.includes(`${resource}.read`)
  )
  const shared = resources
    .map((resource) =>
      resource === "job" ? "Jobs" : "documents (CVs and Letters)"
    )
    .join(" and ")
  const share = shared
    ? `All current and future ${shared}. ${writes ? "Every change waits for your approval." : "This agent cannot make changes."}`
    : "Connection status only. No documents or Jobs shared."
  const readCopy = reads ? "Reads allowed" : null
  const writeCopy = writes
    ? "Writes need approval."
    : "This agent cannot make changes."
  return {
    share,
    access: readCopy ? `${readCopy}. ${writeCopy}` : writeCopy,
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

export function consentQueryFromSearch(search: string) {
  const stripped = search.replace(/^\?/, "")
  const values: string[] = []
  for (const part of stripped.split("&")) {
    if (!part) continue
    const split = part.indexOf("=")
    const rawKey = split === -1 ? part : part.slice(0, split)
    if (decoded(rawKey) !== "oauth_query") continue
    values.push(decoded(split === -1 ? "" : part.slice(split + 1)))
  }
  if (values.length > 1) return null
  return values[0] ?? stripped
}

export function scopesFromSearch(search: string) {
  const query = consentQueryFromSearch(search)
  if (query === null) return []
  const scope = queryPairs(query).get("scope") ?? ""
  return scope.split(/\s+/).filter(Boolean)
}
