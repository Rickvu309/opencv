import { useQuery } from "@tanstack/react-query"

import { fetchProfile, profileKey } from "@/lib/account-api.ts"
import { personName } from "@/features/settings/person-initials.ts"
import { authClient } from "@/lib/auth-client.ts"

export function useShellProfile() {
  const session = authClient.useSession()
  const query = useQuery({
    queryKey: profileKey(),
    queryFn: fetchProfile,
  })
  const sessionUser = session.data?.user
  const name = query.data?.name?.trim() || sessionUser?.name?.trim() || ""
  const image = query.data?.image || sessionUser?.image || null
  const email = query.data?.email?.trim() || sessionUser?.email?.trim() || ""
  return { name: personName(name, email), email, image }
}
