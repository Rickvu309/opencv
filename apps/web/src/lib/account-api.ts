import type { QueryOutput } from "@workspace/domain"

import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { queryKey } from "@/lib/contract-client.ts"
import { endpoints } from "@/lib/requests.ts"

export const profileKey = () => queryKey({ query: "profile.get" })
export const usageKey = () => queryKey({ query: "coach.usage" })
export const integrationsKey = () => queryKey({ query: "integrations.list" })
export const billingKey = () => queryKey({ query: "billing.get" })

export function fetchProfile() {
  return apiFetch<SuccessBody<QueryOutput<"profile.get">>>(
    endpoints.profile
  ).then(unwrapData)
}

export function fetchUsage() {
  return apiFetch<SuccessBody<QueryOutput<"coach.usage">>>(
    endpoints.coachUsage
  ).then(unwrapData)
}

export function fetchIntegrations() {
  return apiFetch<SuccessBody<QueryOutput<"integrations.list">>>(
    endpoints.integrations
  ).then(unwrapData)
}

export function fetchBilling() {
  return apiFetch<SuccessBody<QueryOutput<"billing.get">>>(
    endpoints.billing
  ).then(unwrapData)
}
