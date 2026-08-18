import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { Hoverable } from "@/ui/hoverable";
import { MarkdownBody } from "@/features/coach/components/md";

function ChatMessage({
  role,
  text,
  onCopy,
  onRetry,
}: {
  role: string;
  text: string;
  onCopy?: () => void;
  onRetry?: () => void;
}) {
  const isUser = role === "user";
  if (isUser) {
    return (
      <p className="ml-auto max-w-[65ch] rounded-[var(--radius-container)] bg-surface-2 px-3 py-2 text-[15px] leading-[1.6]">
        {text}
      </p>
    );
  }
  return (
    <Hoverable.Root>
      <div>
        <MarkdownBody text={text} />
        {onCopy || onRetry ? (
          <Hoverable.Item className="mt-1 flex gap-1">
            {onCopy ? (
              <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
                Copy
              </Button>
            ) : null}
            {onRetry ? (
              <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
          </Hoverable.Item>
        ) : null}
      </div>
    </Hoverable.Root>
  );
}

function ChatFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div>
      <p className="text-[15px] text-ink-muted">The Coach didn&apos;t reply. Try again.</p>
      <Button className="mt-2" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function StarterChip({
  label,
  onPick,
}: {
  label: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "inline-flex min-h-[var(--size-touch)] items-center rounded-[var(--radius-pill)] border border-hairline px-3 text-[13px] transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-surface-2 active:scale-[0.97] active:bg-surface-3",
      )}
    >
      {label}
    </button>
  );
}

export { ChatMessage, ChatFailed, StarterChip };
