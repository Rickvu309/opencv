import { useEffect, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Keycap } from "@/ui/keycap";

export function CoachComposer({
  text,
  onText,
  onSend,
  onStop,
  disabled,
  working,
  queued,
}: {
  text: string;
  onText: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  disabled?: boolean;
  working?: boolean;
  queued?: string | null;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const idle = !text.trim() || disabled || (working && !onStop);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }, [text]);

  return (
    <div>
      {queued ? (
        <p className="mb-2 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-[13px] text-ink-muted">
          Sends when the Coach finishes. {queued}
        </p>
      ) : null}
      {working ? (
        <p className="mb-2 text-[13px] text-ink-muted">Stop to send something else.</p>
      ) : null}
      <form
        className="rounded-[var(--radius-container)] border border-hairline bg-surface-1 has-[:focus-visible]:shadow-[var(--focus-ring)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (working && onStop) {
            onStop();
            return;
          }
          if (idle) return;
          onSend();
        }}
      >
        <label htmlFor="composer" className="sr-only">
          Message
        </label>
        <textarea
          ref={ref}
          id="composer"
          rows={1}
          value={text}
          disabled={disabled}
          placeholder="Write to the Coach. Enter sends, Shift+Enter for a new line."
          className="min-h-[var(--size-touch)] w-full resize-none bg-transparent px-3 pt-3 text-[15px] leading-[1.6] text-ink outline-none placeholder:text-ink-faint focus-visible:shadow-none"
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (working && onStop) {
                onStop();
                return;
              }
              if (idle) return;
              onSend();
            }
          }}
        />
        <div className="flex items-center justify-between p-2">
          <span className="hidden text-[12px] text-ink-faint sm:inline">
            <Keycap>Enter</Keycap> sends
          </span>
          <button
            type="submit"
            aria-label={working ? "Stop" : "Send"}
            disabled={working ? false : idle}
            className={cn(
              "flex size-11 items-center justify-center rounded-[var(--radius-control)] bg-accent text-on-accent transition-[background-color,transform,opacity] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97] disabled:opacity-50",
              "hover:bg-accent-hover",
            )}
          >
            {working ? (
              <Square className="size-3.5 fill-current" aria-hidden="true" />
            ) : (
              <ArrowUp className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
