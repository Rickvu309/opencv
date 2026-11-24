import { apiBaseUrl, apiFetch } from "@/lib/api.ts"
import { queryKey, readOperation } from "@/lib/contract-client.ts"

export const agentServerUrl = new URL("/mcp", apiBaseUrl).href
export const consentKey = (query: string) =>
  ["connection-consent", query] as const
export const continuationKey = (query: string) =>
  ["connection-continue", query] as const

export const connectionsKey = () => queryKey({ query: "connections.list" })

export function fetchConnections() {
  return readOperation("connections.list", {})
}

export function consentClient(oauthQuery: string) {
  return apiFetch<{
    client_name?: string
    client_id: string
    client_uri?: string
  }>("/api/auth/oauth2/public-client-prelogin", {
    method: "POST",
    body: JSON.stringify({
      client_id: new URLSearchParams(oauthQuery).get("client_id"),
      oauth_query: oauthQuery,
    }),
  })
}

export function answerConsent(oauthQuery: string, accept: boolean) {
  return apiFetch<{ url: string }>("/api/auth/oauth2/consent", {
    method: "POST",
    body: JSON.stringify({ accept, oauth_query: oauthQuery }),
  })
}

export function continueAuthorization(oauthQuery: string) {
  return apiFetch<{ url: string }>("/api/auth/oauth2/continue", {
    method: "POST",
    body: JSON.stringify({ oauth_query: oauthQuery, postLogin: true }),
  })
}
