import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";

export function ChatMessage({
  role,
  text,
}: {
  role: string;
  text: string;
}) {
  const isUser = role === "user";
  return (
    <p
      className={cn(
        "max-w-[65ch] text-[15px] leading-[1.6]",
        isUser
          ? "ml-auto rounded-[var(--radius-container)] bg-surface-2 px-3 py-2"
          : "text-ink",
      )}
    >
      {text}
    </p>
  );
}

export function ChatFailed({
  onRetry,
}: {
  onRetry: () => void;
}) {
  return (
    <div>
      <p className="text-[15px] text-ink-muted">The Coach didn&apos;t reply. Try again.</p>
      <Button className="mt-2" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function StarterChip({
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
      className="inline-flex min-h-11 items-center rounded-[var(--radius-pill)] border border-hairline px-3 text-[13px] transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-surface-2 active:scale-[0.97] active:bg-surface-3"
    >
      {label}
    </button>
  );
}
