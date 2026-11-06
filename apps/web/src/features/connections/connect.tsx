import { signedConsentQuery } from "@/lib/oauth-consent.ts"
import { useQuery } from "@tanstack/react-query"
import {
  continueAuthorization,
  continuationKey,
} from "@/lib/connections-api.ts"

export function ContinueConnection() {
  const oauthQuery = signedConsentQuery(window.location.search)
  const continuation = useQuery({
    queryKey: continuationKey(oauthQuery),
    queryFn: async () => {
      const { url } = await continueAuthorization(oauthQuery)
      window.location.assign(url)
      return true
    },
    retry: false,
    staleTime: Infinity,
  })
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6 text-foreground">
      <p role={continuation.isError ? "alert" : "status"}>
        {continuation.isError
          ? "This connection request expired. Start again from your agent."
          : "Continuing your connection…"}
      </p>
    </main>
  )
}
