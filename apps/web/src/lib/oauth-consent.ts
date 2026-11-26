import { consentQueryFromSearch } from "@workspace/domain/agents"

export function signedConsentQuery(search: string) {
  return consentQueryFromSearch(search)
}

export function authorizationResumePath(pathname: string, search: string) {
  const query = signedConsentQuery(search)
  if (query === null) return pathname
  return `${pathname}?oauth_query=${encodeURIComponent(query)}`
}
