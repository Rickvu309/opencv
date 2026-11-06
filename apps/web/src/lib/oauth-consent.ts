export function signedConsentQuery(search: string) {
  return (
    new URLSearchParams(search).get("oauth_query") ?? search.replace(/^\?/, "")
  )
}

export function authorizationResumePath(pathname: string, search: string) {
  return `${pathname}?oauth_query=${encodeURIComponent(signedConsentQuery(search))}`
}
