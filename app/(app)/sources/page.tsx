"use client";

import { PageHeader } from "@/components/shell/page-header";
import { ToolsHub } from "@/components/sources/tools-hub";
import { useCopilotSurface, useStore } from "@/lib/store";

export default function SourcesPage() {
  useCopilotSurface("Sources");
  const { state } = useStore();

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Sources"
        description="What OpenPath reads from your connected tools, and what to do with it."
      />
      <div className="flex flex-col gap-6 p-6">
        <ToolsHub sources={state.connectedSources} />
      </div>
    </div>
  );
}
