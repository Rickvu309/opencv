import { ToolCard } from "@/components/sources/tool-card";
import type { ConnectedSource } from "@/lib/types";

/**
 * The top zone of /sources: one card per connected tool, plus a quiet "more
 * tools soon" placeholder so the row never reads as a closed, finished set.
 */
export function ToolsHub({ sources }: { sources: ConnectedSource[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2>Connected tools</h2>
      <div className="grid grid-cols-4 gap-3">
        {sources.map((source) => (
          <ToolCard key={source.id} source={source} />
        ))}
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border bg-muted/20 p-4">
          <p className="text-sm font-medium text-muted-foreground">More tools soon</p>
          <p className="text-xs text-muted-foreground">Slack, Notion, and shared calendars are next on the list.</p>
        </div>
      </div>
    </section>
  );
}
