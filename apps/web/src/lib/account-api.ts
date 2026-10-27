import type { QueryOutput } from "@workspace/domain"

import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { queryKey } from "@/lib/contract-client.ts"

/** One key per account read, shared by every reader of it. */
export const profileKey = () => queryKey({ query: "profile.get" })
export const usageKey = () => queryKey({ query: "coach.usage" })
export const integrationsKey = () => queryKey({ query: "integrations.list" })
export const billingKey = () => queryKey({ query: "billing.get" })

export function fetchProfile() {
  return apiFetch<SuccessBody<QueryOutput<"profile.get">>>("/api/profile").then(
    unwrapData
  )
}

export function fetchUsage() {
  return apiFetch<SuccessBody<QueryOutput<"coach.usage">>>(
    "/api/coach/usage"
  ).then(unwrapData)
}

export function fetchIntegrations() {
  return apiFetch<SuccessBody<QueryOutput<"integrations.list">>>(
    "/api/integrations"
  ).then(unwrapData)
}

export function fetchBilling() {
  return apiFetch<SuccessBody<QueryOutput<"billing.get">>>("/api/billing").then(
    unwrapData
  )
}
