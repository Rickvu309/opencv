import { useEffect, useRef } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function CoachComposer({
  text,
  onText,
  onSend,
  disabled,
  working,
}: {
  text: string;
  onText: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  working?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const idle = !text.trim() || disabled || working;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }, [text]);

  return (
    <form
      className="rounded-[var(--radius-container)] border border-hairline bg-surface-1 has-[:focus-visible]:shadow-[var(--focus-ring)]"
      onSubmit={(e) => {
        e.preventDefault();
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
        disabled={disabled || working}
        placeholder="Write to the Coach. Enter sends, Shift+Enter for a new line."
        className="min-h-11 w-full resize-none bg-transparent px-3 pt-3 text-[15px] leading-[1.6] text-ink outline-none placeholder:text-ink-faint focus-visible:shadow-none"
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (idle) return;
            onSend();
          }
        }}
      />
      <div className="flex justify-end p-2">
        <button
          type="submit"
          aria-label="Send"
          disabled={idle}
          className={cn(
            "flex size-11 items-center justify-center rounded-[var(--radius-control)] bg-accent text-on-accent transition-[background-color,transform,opacity] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97] disabled:opacity-50",
            !idle && "hover:bg-accent-hover",
          )}
        >
          <ArrowUp className="size-4" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
