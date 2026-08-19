import { ArrowUp, Paperclip } from "lucide-react";
import { useState } from "react";
import { cn } from "../../cn";
import "./beautiful.css";
import { DemoSwitch } from "./demo-switch";

export type PromptBarShape = "vanilla" | "rounded" | "pill";

export interface PromptSource {
  label: string;
  hint: string;
}

export interface PromptBarProps {
  placeholder?: string;
  shape?: PromptBarShape;
  sources?: PromptSource[];
  showAttach?: boolean;
  showSwitcher?: boolean;
  onSend?: (value: string) => void;
}

const DEFAULT_SOURCES: PromptSource[] = [
  { label: "Add photos and files", hint: "Upload from your computer" },
  { label: "Sales data", hint: "Volume and margin metrics" },
  { label: "Record set", hint: "26 makers, tags, links" },
  { label: "Web search", hint: "Live news and references" },
];

export function PromptBar({
  placeholder = "Write a message…",
  shape: shapeProp,
  sources = DEFAULT_SOURCES,
  showAttach = true,
  showSwitcher = true,
  onSend,
}: PromptBarProps) {
  const [shape, setShape] = useState<PromptBarShape>(shapeProp ?? "vanilla");
  const [value, setValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const radius =
    shape === "pill"
      ? "rounded-[var(--radius-pill)]"
      : shape === "rounded"
        ? "rounded-[var(--radius-container)]"
        : "rounded-[var(--radius-control)]";

  function send() {
    const next = value.trim();
    if (!next) return;
    onSend?.(next);
    setValue("");
  }

  return (
    <div className="relative w-full max-w-[26rem]">
      {menuOpen && showAttach ? (
        <div className="absolute inset-x-0 bottom-full z-10 mb-2 rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-1 shadow-[var(--shadow-overlay)]">
          {sources.map((source) => (
            <button
              key={source.label}
              type="button"
              className="flex h-9 w-full items-center gap-2.5 rounded-[var(--radius-control)] px-2 text-left hover:bg-surface-2"
              onClick={() => setMenuOpen(false)}
            >
              <span className="shrink-0 text-[12.5px] font-[510] text-ink">{source.label}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-ink-faint">{source.hint}</span>
            </button>
          ))}
        </div>
      ) : null}
      <form
        className={cn(
          "flex min-h-10 items-end gap-1 border border-hairline bg-surface-1 p-1",
          radius,
        )}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {showAttach ? (
          <button
            type="button"
            aria-label="Add attachments and sources"
            aria-expanded={menuOpen}
            className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-ink-muted transition-colors duration-[var(--duration-fast)] hover:bg-surface-2"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Paperclip className="size-4" aria-hidden="true" />
          </button>
        ) : null}
        <label className="sr-only" htmlFor="beautiful-prompt">
          Prompt
        </label>
        <textarea
          id="beautiful-prompt"
          rows={1}
          value={value}
          placeholder={placeholder}
          className="min-h-8 min-w-0 flex-1 resize-none bg-transparent px-1 py-1.5 text-[13px] leading-5 text-ink outline-none placeholder:text-ink-faint"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!value.trim()}
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-[opacity,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97] disabled:opacity-40",
          )}
        >
          <ArrowUp className="size-4" aria-hidden="true" />
        </button>
      </form>
      {showSwitcher ? (
        <DemoSwitch
          value={shape}
          onChange={setShape}
          options={["vanilla", "rounded", "pill"] as const}
        />
      ) : null}
    </div>
  );
}
