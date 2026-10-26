import { useQuery } from "@tanstack/react-query"

import { getShellProfile } from "@/features/app-shell/shell-api.ts"
import { authClient } from "@/lib/auth-client.ts"

export function useShellProfile() {
  const session = authClient.useSession()
  const query = useQuery({
    queryKey: ["shell", "profile"],
    queryFn: async () => {
      try {
        return await getShellProfile()
      } catch {
        return null
      }
    },
  })
  const sessionUser = session.data?.user
  const name =
    query.data?.name?.trim() || sessionUser?.name?.trim() || "Account"
  const image = query.data?.image || sessionUser?.image || null
  return { name, image }
}
