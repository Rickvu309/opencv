import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConnectSourceDialog } from "@/components/sources/connect-source-dialog";
import { SourceStatusChip } from "@/components/sources/source-status-chip";
import { freshnessLabel } from "@/lib/inbox-utils";
import type { ConnectedSource } from "@/lib/types";

/**
 * One connected-tool card: what it gives OpenPath, what it unlocks, its
 * status chip, and either its last sync (connected) or a Connect button
 * that opens the onboarding dialog (not connected).
 */
export function ToolCard({ source }: { source: ConnectedSource }) {
  const connected = source.status === "connected";

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{source.name}</p>
          <SourceStatusChip status={source.status} />
        </div>
        <p className="text-xs text-muted-foreground">{source.readsDescription}</p>
        <p className="text-xs text-foreground">{source.unlocksDescription}</p>
        {connected ? (
          <span className="text-xs text-muted-foreground">
            Synced {freshnessLabel(source.lastSyncedMinutesAgo ?? 0)}
          </span>
        ) : (
          <ConnectSourceDialog source={source}>
            <Button size="sm" variant="outline" className="w-fit">
              Connect
            </Button>
          </ConnectSourceDialog>
        )}
      </CardContent>
    </Card>
  );
}
