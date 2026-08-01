import { Card, CardContent } from "@/components/ui/card";
import { ToolCard } from "@/components/sources/tool-card";
import type { ConnectedSource } from "@/lib/types";

/**
 * The top zone of /sources: one card per connected tool, plus a quiet "more
 * tools soon" placeholder so the row never reads as a closed, finished set.
 * Built on the same Card primitive at the same size="sm" density as
 * ToolCard so the placeholder shares its sibling's radius and interior
 * padding instead of a hand-rolled div with its own values.
 */
export function ToolsHub({ sources }: { sources: ConnectedSource[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2>Connected tools</h2>
      <div className="grid grid-cols-4 items-start gap-3">
        {sources.map((source) => (
          <ToolCard key={source.id} source={source} />
        ))}
        <Card size="sm" className="border border-dashed border-border bg-muted/20 ring-0">
          <CardContent className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-muted-foreground">More tools soon</p>
            <p className="text-xs text-muted-foreground">Slack, Notion, and shared calendars are next on the list.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
