import { useQuery } from "@tanstack/react-query"

import { profileQuery } from "@/lib/account-api.ts"
import { useOwnerId } from "@/lib/owner-id.ts"

export function useShellProfile() {
  const query = useQuery(profileQuery(useOwnerId()))
  const name = query.data?.name.trim() ?? ""
  const email = query.data?.email.trim() ?? ""
  return {
    name,
    email,
    image: query.data?.image ?? null,
    label: name || email,
  }
}
