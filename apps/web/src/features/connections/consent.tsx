import {
  CONNECTION_TOKEN_SECONDS,
  grantCopy,
  resourcesForScopes,
  scopesFromSearch,
} from "@workspace/domain"
import { authClient } from "@/lib/auth-client.ts"
import { signedConsentQuery } from "@/lib/oauth-consent.ts"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  answerConsent,
  consentClient,
  consentKey,
} from "@/lib/connections-api.ts"

export function ConnectionConsent() {
  const { data: session } = authClient.useSession()
  const oauthQuery = signedConsentQuery(window.location.search)
  const client = useQuery({
    queryKey: consentKey(oauthQuery ?? ""),
    queryFn: () => {
      if (oauthQuery === null) throw new Error("missing query")
      return consentClient(oauthQuery)
    },
    enabled: oauthQuery !== null,
    retry: false,
  })
  const clientId = client.data?.client_id
  const metadataOrigin = clientId?.startsWith("https://")
    ? new URL(clientId).origin
    : null
  const answer = useMutation({
    mutationFn: (accept: boolean) => {
      if (oauthQuery === null) throw new Error("missing query")
      return answerConsent(oauthQuery, accept)
    },
    onSuccess: ({ url }) => window.location.assign(url),
  })
  const requested = oauthQuery === null ? null : scopesFromSearch(oauthQuery)
  const grant =
    requested === null
      ? null
      : grantCopy({
          resources: resourcesForScopes(requested),
          scopes: requested,
        })
  return (
    <main className="grid min-h-svh place-items-center bg-background px-4 py-12 text-foreground">
      <section
        className="flex w-full max-w-lg flex-col gap-5 rounded-xl border border-border bg-card p-6 shadow-sm"
        aria-labelledby="consent-title"
      >
        <p className="text-sm font-medium text-muted-foreground">
          OpenCV agent connection
        </p>
        <h1 id="consent-title" className="text-2xl font-semibold break-words">
          Connect this agent?
        </h1>
        {client.data ? (
          <dl className="grid gap-3 rounded-lg border border-border bg-muted p-4">
            <div>
              <dt className="text-sm text-muted-foreground">
                Client identifier
              </dt>
              <dd className="font-semibold break-all">
                {client.data.client_id}
              </dd>
            </div>
            {metadataOrigin ? (
              <div>
                <dt className="text-sm text-muted-foreground">
                  Client metadata origin
                </dt>
                <dd className="font-semibold break-all">{metadataOrigin}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-sm text-muted-foreground">
                App-supplied name (unverified)
              </dt>
              <dd className="break-words">
                {client.data.client_name ?? "Not supplied"}
              </dd>
            </div>
          </dl>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Any app can choose this name. Check the client identifier
          {metadataOrigin ? " and metadata origin" : ""} before allowing access.
          OpenCV has not verified the app’s vendor.
        </p>
        <p className="text-sm break-all">Connecting as {session?.user.email}</p>
        {grant ? (
          <>
            <p>{grant.share}</p>
            <p className="text-sm text-muted-foreground">
              {grant.access} Every proposed change waits for you to approve or
              deny it in OpenCV. Only the resources listed above are shared. You
              can revoke access in Settings → Integrations at any time.
            </p>
          </>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Access tokens last {CONNECTION_TOKEN_SECONDS.access / 3600} hour. With
          offline access, this connection lasts{" "}
          {CONNECTION_TOKEN_SECONDS.refresh / 86400} days.
        </p>
        <p className="text-sm text-muted-foreground">
          Data your agent reads leaves OpenCV. Data an agent has already read
          cannot be taken back.
        </p>
        {oauthQuery === null || client.isError || answer.isError ? (
          <p role="alert" className="text-sm text-destructive">
            This connection request could not be verified. Start again from your
            agent.
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            size="touch-lg"
            variant="outline"
            disabled={oauthQuery === null || !client.data || answer.isPending}
            onClick={() => answer.mutate(false)}
          >
            Cancel
          </Button>
          <Button
            size="touch-lg"
            disabled={oauthQuery === null || !client.data || answer.isPending}
            onClick={() => answer.mutate(true)}
          >
            {answer.isPending ? "Connecting…" : "Allow connection"}
          </Button>
        </div>
      </section>
    </main>
  )
}
