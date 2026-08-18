import { useState } from "react";
import { AlertCircle, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/ui/chip";
import { Code } from "@/ui/code";
import { Loader } from "@/ui/loader";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/collapsible";
import type { ToolCallView } from "@/features/coach/model";
import { Button } from "@/ui/button";
import { navigateToOpen } from "@/features/coach/open";
import { useNavigate } from "@tanstack/react-router";
import type { AppOpenResult } from "@/features/coach/model";

function verbFor(name: string) {
  const [noun, action] = name.split(".");
  if (action === "open") return "Open";
  if (action === "create" || action === "add") return `Add ${noun}`;
  if (action === "remove") return `Remove ${noun}`;
  if (action === "update" || action === "rename") return `Update ${noun}`;
  if (action === "log") return "Log Proof";
  return name.replaceAll(".", " ");
}

function StatusIcon({ status }: { status: ToolCallView["status"] }) {
  if (status === "pending") return <Loader label="Running" />;
  if (status === "failed") {
    return <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />;
  }
  return <Check className="size-4 shrink-0 text-status-positive" aria-hidden="true" />;
}

function OpenArtifact({ result }: { result: AppOpenResult & { ok: true } }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-3">
      <p className="text-[13px] text-ink-muted">{result.place}</p>
      <p className="text-[15px] font-[510]">Opened</p>
      <Button
        size="sm"
        variant="outline"
        className="mt-2"
        onClick={() => void navigateToOpen(navigate, result)}
      >
        Open {result.place}
      </Button>
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function ToolBody({ call }: { call: ToolCallView }) {
  const data = asRecord(call.output) ?? asRecord(call.input);
  if (call.name.startsWith("paper.") && data) {
    const before = typeof data.before === "string" ? data.before : "";
    const after = typeof data.after === "string" ? data.after : "";
    if (before || after) {
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {before ? <Code value={before}>{before}</Code> : null}
          {after ? <Code value={after}>{after}</Code> : null}
        </div>
      );
    }
  }
  if (call.name.startsWith("opening.") && data) {
    const title = typeof data.title === "string" ? data.title : call.name;
    const company = typeof data.company === "string" ? data.company : "";
    return (
      <p className="text-[13px] leading-[1.5] text-ink">
        {title}
        {company ? <span className="text-ink-muted"> · {company}</span> : null}
      </p>
    );
  }
  if (
    (call.name.startsWith("profile.") || call.name.startsWith("proof.")) &&
    (call.name.endsWith(".get") || call.name.endsWith(".read") || call.name.endsWith(".list"))
  ) {
    const raw = JSON.stringify(call.output ?? call.input ?? {}, null, 2);
    return <Code value={raw}>{raw}</Code>;
  }
  const raw =
    typeof call.output === "string"
      ? call.output
      : call.output
        ? JSON.stringify(call.output, null, 2)
        : call.input
          ? JSON.stringify(call.input, null, 2)
          : "";
  if (!raw) return null;
  return <Code value={raw}>{raw}</Code>;
}

interface ToolCardProps {
  call: ToolCallView;
  dense?: boolean;
}

function ToolCard({ call, dense = false }: ToolCardProps) {
  const failed = call.status === "failed";
  const [open, setOpen] = useState(failed);
  const isOpen = call.name === "app.open";
  const result = call.output as AppOpenResult | undefined;

  if (isOpen && result && result.ok && call.status === "completed") {
    return <OpenArtifact result={result} />;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "rounded-[var(--radius-control)] border border-hairline bg-surface-1",
          failed && "border-destructive/40",
          call.status === "pending" && "border-accent/40",
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2 text-left",
              dense ? "px-3 py-1" : "px-3 py-2",
              "min-h-10 hover:bg-surface-2",
            )}
          >
            <StatusIcon status={call.status} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
              {verbFor(call.name)}
            </span>
            <Chip tone="code">{call.name}</Chip>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-ink-muted transition-transform duration-150",
                !open && "-rotate-90",
              )}
              aria-hidden="true"
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3">
            <ToolBody call={call} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function ToolGroup({ calls }: { calls: ToolCallView[] }) {
  if (calls.length === 0) return null;
  if (calls.length === 1) return <ToolCard call={calls[0]!} />;
  return (
    <div className="space-y-1 rounded-[var(--radius-container)] border border-hairline p-1">
      {calls.map((call) => (
        <ToolCard key={call.id} call={call} dense />
      ))}
    </div>
  );
}

export { ToolCard, ToolGroup };
