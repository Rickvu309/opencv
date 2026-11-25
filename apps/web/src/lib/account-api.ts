import type { QueryOutput } from "@workspace/domain"

import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { queryKey } from "@/lib/contract-client.ts"
import { endpoints } from "@/lib/requests.ts"

export const profileKey = () => queryKey({ query: "profile.get" })

export function fetchProfile() {
  return apiFetch<SuccessBody<QueryOutput<"profile.get">>>(
    endpoints.profile
  ).then(unwrapData)
}

export const profileQuery = () => ({
  queryKey: profileKey(),
  queryFn: fetchProfile,
})
