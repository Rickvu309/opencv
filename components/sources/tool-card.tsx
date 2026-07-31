import { Card, CardContent } from "@/components/ui/card";
import { ConnectSourceDialog } from "@/components/sources/connect-source-dialog";
import { SourceStatusChip } from "@/components/sources/source-status-chip";
import type { ConnectedSource } from "@/lib/types";

/**
 * One connected-tool card: what it gives OpenPath, what it unlocks, its
 * status chip, and the connect action or last-sync line. The action itself
 * always renders through ConnectSourceDialog (never swapped out based on
 * status) so a connect flow in progress survives the status flip that
 * happens mid-dialog when connecting completes.
 */
export function ToolCard({ source }: { source: ConnectedSource }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{source.name}</p>
          <SourceStatusChip status={source.status} />
        </div>
        <p className="text-xs text-muted-foreground">{source.readsDescription}</p>
        <p className="text-xs text-foreground">{source.unlocksDescription}</p>
        <ConnectSourceDialog source={source} />
      </CardContent>
    </Card>
  );
}
