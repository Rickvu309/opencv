import { catalog } from "@workspace/domain"

import { catalogClient } from "@/lib/contract-client.ts"

export const PROFILE_FRESH_MS = 60_000

export function profileKey(ownerId: string) {
  return catalogClient.key(ownerId, "profile.get", {})
}

export function profileQuery(ownerId: string) {
  return {
    ...catalogClient.options(ownerId, "profile.get", {}),
    staleTime: PROFILE_FRESH_MS,
  }
}

export function fetchProfile() {
  return catalogClient.read(catalog["profile.get"].name, {})
}
