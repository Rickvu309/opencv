import { useEffect, useState } from "react";
import { AlertCircle, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/collapsible";
import { useNavigate } from "@tanstack/react-router";
import { navigateToOpen } from "@/features/coach/open";
import type { AppOpenResult, ToolCallView } from "@/features/coach/model";
import { payloadText, queryFromInput, toolCallCopy } from "./tool-call";

export interface ToolCallProps {
  label: string;
  activeLabel: string;
  query?: string;
  request?: string;
  result?: string;
  running: boolean;
  failed?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

export function ToolCall({
  label,
  activeLabel,
  query = "",
  request = "",
  result = "",
  running,
  failed = false,
  defaultOpen = false,
  className,
}: ToolCallProps) {
  const [open, setOpen] = useState(defaultOpen || failed);
  const hasBody = Boolean(request || result);

  useEffect(() => {
    if (failed) setOpen(true);
  }, [failed]);

  return (
    <Collapsible
      data-slot="tool-call"
      open={open}
      onOpenChange={setOpen}
      className={cn("group w-full", className)}
    >
      <CollapsibleTrigger className="flex min-h-[var(--size-touch)] w-full items-center gap-2 py-1 text-left text-[13px] text-ink-muted transition-[color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:text-ink active:scale-[0.97] md:min-h-10">
        <ChevronRight
          className="size-3.5 shrink-0 opacity-60 transition-transform duration-[150ms] ease-[var(--ease-out)] group-data-[state=open]:rotate-90 motion-reduce:transition-none"
          aria-hidden="true"
        />
        {running ? (
          <span className="think-shimmer relative min-w-0 truncate leading-none">{activeLabel}</span>
        ) : (
          <span className="min-w-0 truncate">{failed ? activeLabel : label}</span>
        )}
        {query ? (
          <span className="max-w-[40%] shrink-0 truncate rounded-[var(--radius-control)] bg-surface-2 px-2 py-1 font-mono text-[12px] text-ink-secondary">
            {query}
          </span>
        ) : null}
        <span className="ms-auto flex w-4 shrink-0 items-center justify-end">
          {running ? null : failed ? (
            <AlertCircle className="size-3.5 text-destructive" aria-hidden="true" />
          ) : (
            <Check className="size-3.5 text-status-positive" aria-hidden="true" />
          )}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {hasBody ? (
          <div className="mt-2 overflow-hidden rounded-[var(--radius-container)] bg-surface-2 text-[13px]">
            {request ? (
              <div className="px-3 pt-3 pb-2">
                <p className="mb-1 font-mono text-[12px] text-ink-faint">Request</p>
                <p className="font-mono break-words text-ink-muted">{request}</p>
              </div>
            ) : null}
            {request && result ? <div className="mx-3 h-px bg-hairline" /> : null}
            {result ? (
              <div className="px-3 pt-2 pb-3">
                <p className="mb-1 font-mono text-[12px] text-ink-faint">Result</p>
                <p className="break-words text-ink">{result}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
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

export interface ToolCardProps {
  call: ToolCallView;
}

export function ToolCard({ call }: ToolCardProps) {
  const isOpen = call.name === "app.open";
  const result = call.output as AppOpenResult | undefined;
  if (isOpen && result && result.ok && call.status === "completed") {
    return <OpenArtifact result={result} />;
  }

  const { activeLabel, label } = toolCallCopy(call.name);
  return (
    <ToolCall
      label={label}
      activeLabel={activeLabel}
      query={queryFromInput(call.input)}
      request={payloadText(call.input)}
      result={payloadText(call.output)}
      running={call.status === "pending"}
      failed={call.status === "failed"}
    />
  );
}

export function ToolGroup({ calls }: { calls: ToolCallView[] }) {
  if (calls.length === 0) return null;
  return (
    <div className="flex w-full flex-col gap-1">
      {calls.map((call) => (
        <ToolCard key={call.id} call={call} />
      ))}
    </div>
  );
}
