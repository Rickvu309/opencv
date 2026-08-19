import { ArrowUp, ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../dropdown-menu";
import { Input } from "../../input";
import "./beautiful.css";

export interface SelectionActionsProps {
  before?: string;
  selected?: string;
  after?: string;
  actions?: string[];
}

export function SelectionActions({
  before = "North batch holds the top slot all weekend. ",
  selected = "Run it first thing Saturday so the batch has time to firm up before the afternoon rush.",
  after = "",
  actions = ["Explain", "Improve", "Shorten", "Tone", "Grammar"],
}: SelectionActionsProps) {
  const [instruction, setInstruction] = useState("");
  const [applied, setApplied] = useState<string | null>(null);

  return (
    <div className="relative w-full max-w-[28rem] pb-14">
      <p className="text-[13px] leading-relaxed text-ink">
        {before}
        <mark className="rounded-[3px] bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface-1))] text-ink">
          {selected}
        </mark>
        {after}
      </p>
      <div className="absolute top-full left-1/2 z-10 mt-2 -translate-x-1/2">
        <div className="flex h-9 w-max max-w-[calc(100vw-48px)] items-center gap-0.5 overflow-hidden rounded-full border border-hairline bg-surface-1 p-1 shadow-[var(--shadow-overlay)]">
          <form
            className="flex h-7 items-center"
            onSubmit={(e) => {
              e.preventDefault();
              if (instruction.trim()) setApplied(instruction.trim());
            }}
          >
            <Input
              aria-label="Describe edits"
              placeholder="Describe edits"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="h-7 min-h-0 w-[9rem] border-0 bg-transparent px-3 text-[12.5px] shadow-none focus-visible:border-0"
            />
          </form>
          <span className="mx-1 h-4 w-px shrink-0 bg-hairline" aria-hidden="true" />
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              className="inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-[12px] text-ink transition-colors duration-[var(--duration-fast)] hover:bg-surface-2 active:scale-[0.97]"
              onClick={() => setApplied(action)}
            >
              {action}
            </button>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Show more actions"
              className="inline-flex size-7 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2"
            >
              <ChevronDown className="size-3.5" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setApplied("Translate")}>Translate</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setApplied("Bullet list")}>Bullet list</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            aria-label="Send edit instruction"
            className="flex size-7 items-center justify-center rounded-full bg-accent text-on-accent"
            onClick={() => instruction.trim() && setApplied(instruction.trim())}
          >
            <ArrowUp className="size-3.5" aria-hidden="true" />
          </button>
        </div>
        {applied ? (
          <p className="mt-2 text-center text-[12px] text-ink-muted" role="status">
            Handed to rewrite: {applied}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
