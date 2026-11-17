import { useQuery } from "@tanstack/react-query"

import { fetchProfile, profileKey } from "@/lib/account-api.ts"
import { authClient } from "@/lib/auth-client.ts"
import { personName } from "@/lib/person-initials.ts"

export function useShellProfile() {
  const session = authClient.useSession()
  const query = useQuery({
    queryKey: profileKey(),
    queryFn: fetchProfile,
  })
  const sessionUser = session.data?.user
  const rawName = query.data?.name?.trim() || sessionUser?.name?.trim() || ""
  const image = query.data?.image || sessionUser?.image || null
  const email = query.data?.email?.trim() || sessionUser?.email?.trim() || ""
  return {
    name: personName(rawName, email),
    email,
    image,
    nameFromEmail: rawName.length === 0 && email.length > 0,
  }
}
