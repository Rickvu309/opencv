import { useQuery } from "@tanstack/react-query"

import { profileQuery } from "@/lib/account-api.ts"
import { useOwnerId } from "@/lib/owner-id.ts"

import { PROFILE_ZONE } from "./apply-stages.ts"

export function useChosenTimeZone() {
  const profile = useQuery(profileQuery(useOwnerId()))
  const zone = profile.data?.timeZone
  return typeof zone === "string" && zone.length > 0 ? zone : PROFILE_ZONE
}
