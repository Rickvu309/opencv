import { signedConsentQuery } from "@/lib/oauth-consent.ts"
import { useQuery } from "@tanstack/react-query"
import {
  continueAuthorization,
  continuationKey,
} from "@/lib/connections-api.ts"

export function ContinueConnection() {
  const oauthQuery = signedConsentQuery(window.location.search)
  const continuation = useQuery({
    queryKey: continuationKey(oauthQuery ?? ""),
    queryFn: async () => {
      if (oauthQuery === null) throw new Error("missing query")
      const { url } = await continueAuthorization(oauthQuery)
      window.location.assign(url)
      return true
    },
    enabled: oauthQuery !== null,
    retry: false,
    staleTime: Infinity,
  })
  const failed = oauthQuery === null || continuation.isError
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6 text-foreground">
      <p role={failed ? "alert" : "status"}>
        {failed
          ? "This connection request expired. Start again from your agent."
          : "Continuing your connection…"}
      </p>
    </main>
  )
}
