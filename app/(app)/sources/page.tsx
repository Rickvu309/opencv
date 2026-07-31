"use client";

import { WorkspacePage } from "@/components/shell/workspace-page";
import { ToolsHub } from "@/components/sources/tools-hub";
import { SyncedContextInbox } from "@/components/sources/synced-context-inbox";
import { useCopilotSurface, useStore } from "@/lib/store";

export default function SourcesPage() {
  useCopilotSurface("Sources");
  const { state } = useStore();

  return (
    <WorkspacePage
      title="Sources"
      description="What OpenPath reads from your connected tools, and what to do with it."
    >
      <div className="flex flex-col gap-6">
        <ToolsHub sources={state.connectedSources} />
        <SyncedContextInbox />
      </div>
    </WorkspacePage>
  );
}
