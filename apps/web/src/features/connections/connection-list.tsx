import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  grantCopy,
  type ConnectionId,
  type ConnectionResources,
} from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { connectionsKey, fetchConnections } from "@/lib/connections-api.ts"
import { runContractCommand } from "@/lib/contract-client.ts"
import { ConnectAgent } from "./connect-agent.tsx"

function connectionGrantLines(connection: {
  scopes: readonly string[]
  resources: ConnectionResources
}) {
  const copy = grantCopy(connection)
  return [copy.share, copy.access]
}

export function ConnectionList() {
  const queryClient = useQueryClient()
  const connections = useQuery({
    queryKey: connectionsKey(),
    queryFn: fetchConnections,
  })
  const revoke = useMutation({
    mutationFn: (connectionId: ConnectionId) =>
      runContractCommand(queryClient, "connections.revoke", { connectionId }),
  })
  return (
    <>
      <ConnectAgent />
      <section
        className="my-6 flex flex-col gap-3"
        aria-labelledby="agent-connections-title"
      >
        <h2 id="agent-connections-title" className="text-base font-medium">
          Your agents
        </h2>
        <p className="text-sm text-muted-foreground">
          Revoking stops the next request. Data an agent has already read cannot
          be taken back.
        </p>
        {connections.isPending ? (
          <p role="status">Loading connections…</p>
        ) : null}
        {connections.isError ? (
          <div role="alert">
            Could not load connections.{" "}
            <Button
              className="h-11 md:h-9"
              variant="outline"
              onClick={() => void connections.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : null}
        {connections.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agents connected.</p>
        ) : null}
        {connections.data?.map((connection) => (
          <div
            key={connection.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium break-words">{connection.name}</p>
              <p className="text-sm break-all text-muted-foreground">
                {connection.clientId}
              </p>
              <p className="text-sm text-muted-foreground">
                {connection.revokedAt
                  ? "Revoked"
                  : new Date(connection.expiresAt) <= new Date()
                    ? "Expired"
                    : "Active"}
              </p>
              {connectionGrantLines(connection).map((line) => (
                <p key={line} className="text-sm text-muted-foreground">
                  {line}
                </p>
              ))}
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <dt>Connected</dt>
                <dd>
                  <time dateTime={connection.createdAt}>
                    {new Date(connection.createdAt).toLocaleString()}
                  </time>
                </dd>
                <dt>Last used</dt>
                <dd>
                  {connection.lastUsedAt ? (
                    <time dateTime={connection.lastUsedAt}>
                      {new Date(connection.lastUsedAt).toLocaleString()}
                    </time>
                  ) : (
                    "Never"
                  )}
                </dd>
                <dt>Expires</dt>
                <dd>
                  <time dateTime={connection.expiresAt}>
                    {new Date(connection.expiresAt).toLocaleString()}
                  </time>
                </dd>
              </dl>
            </div>
            {!connection.revokedAt &&
            new Date(connection.expiresAt) > new Date() ? (
              <Button
                className="h-11 md:h-9"
                variant="outline"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(connection.id)}
              >
                Revoke access
              </Button>
            ) : null}
          </div>
        ))}
        {revoke.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Could not revoke access. Try again.
          </p>
        ) : null}
      </section>
    </>
  )
}
