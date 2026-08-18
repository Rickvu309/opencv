import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/collapsible";
import { MarkdownBody } from "@/features/coach/components/md";

interface ThinkingCardProps {
  content: string;
  isStreaming: boolean;
  defaultOpen?: boolean;
}

function ThinkingActivityIcon({ isStreaming }: { isStreaming: boolean }) {
  if (!isStreaming) {
    return <span className="size-1.5 shrink-0 rounded-full bg-ink-muted" aria-hidden="true" />;
  }
  return (
    <span aria-hidden className="relative flex size-4 shrink-0 items-center justify-center">
      <span className="absolute size-3 rounded-full bg-accent-muted motion-safe:animate-ping motion-reduce:hidden" />
      <span className="size-1.5 rounded-full bg-accent" />
    </span>
  );
}

function ThinkingCard({ content, isStreaming, defaultOpen = false }: ThinkingCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  if (!content && !isStreaming) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group flex min-h-10 w-full items-center gap-2 rounded-[var(--radius-control)] px-3 text-left hover:bg-surface-2"
        >
          <ThinkingActivityIcon isStreaming={isStreaming} />
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink-muted">Thinking</span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-ink-muted transition-transform duration-150 motion-reduce:transition-none",
              !isOpen && "-rotate-90",
            )}
            aria-hidden="true"
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="max-h-48 overflow-y-auto px-3 pb-2">
          {content ? (
            <MarkdownBody text={content} className="text-[13px] text-ink-muted" />
          ) : (
            <p className="text-[13px] text-ink-muted">Thinking</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export { ThinkingCard, type ThinkingCardProps };
