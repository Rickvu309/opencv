import { CopilotTag } from "@/components/shared/copilot-tag";
import { cn } from "@/lib/utils";

/**
 * Simulated AI "thinking" state shown briefly before scripted Copilot
 * output appears, so the product feels like AI is participating rather
 * than instantly returning canned text.
 */
export function AiThinking({ label = "Thinking", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <CopilotTag />
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        {label}
        <span className="flex gap-0.5">
          <span className="size-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
          <span className="size-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
          <span className="size-1 animate-bounce rounded-full bg-muted-foreground" />
        </span>
      </span>
    </div>
  );
}
