import { useQuery } from "@tanstack/react-query"

import { profileQuery } from "@/lib/account-api.ts"

import { PROFILE_ZONE } from "./apply-stages.ts"

export function useChosenTimeZone() {
  const profile = useQuery(profileQuery())
  const zone = profile.data?.timeZone
  return typeof zone === "string" && zone.length > 0 ? zone : PROFILE_ZONE
}
