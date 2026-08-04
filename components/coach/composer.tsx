"use client";

import * as React from "react";
import { ArrowUp, ChevronDown, Paperclip, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const coachModes = [
  { id: "auto", label: "Tự động", hint: "Coach tự chọn cách trả lời phù hợp" },
  { id: "advice", label: "Tư vấn", hint: "Phân tích và đưa lời khuyên" },
  { id: "market", label: "Dữ liệu thị trường", hint: "Ưu tiên số liệu tuyển dụng" },
  { id: "review", label: "Review hồ sơ", hint: "Soi CV, LinkedIn, portfolio" },
];

/**
 * Two-row composer like Linear's: textarea on top, tool row below — answer
 * mode on the left, attach and send on the right.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  autoFocus,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const [mode, setMode] = React.useState(coachModes[0]);
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSubmit();
      }}
      className={cn(
        "border bg-card shadow-sm transition-shadow focus-within:shadow-md motion-reduce:transition-none",
        // Inside the floating panel (radius 16, padding 8): inner = 16 − 8. Standalone: 16.
        compact ? "rounded-md" : "rounded-xl",
      )}
    >
      <textarea
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (canSend) onSubmit();
          }
        }}
        placeholder="Hỏi OpenPath Coach…"
        rows={1}
        className={cn(
          // text-base on mobile: iOS Safari zooms the page when an input is under 16px.
          "field-sizing-content max-h-40 w-full resize-none bg-transparent px-4 pt-3.5 text-base leading-6 outline-none placeholder:text-muted-foreground sm:text-[15px]",
          compact && "px-3 pt-3 sm:text-sm",
        )}
      />

      <div className={cn("flex items-center gap-1 p-2", compact && "p-1.5")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-md px-2 text-xs font-normal text-muted-foreground"
            >
              <SlidersHorizontal className="size-3.5" />
              {mode.label}
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {coachModes.map((m) => (
              <DropdownMenuItem
                key={m.id}
                onSelect={() => setMode(m)}
                className="flex-col items-start gap-0.5"
              >
                <span className="text-sm font-medium">{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.hint}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full text-muted-foreground"
            aria-label="Đính kèm CV hoặc liên kết"
          >
            <Paperclip />
          </Button>
          <Button
            type="submit"
            size="icon-sm"
            disabled={!canSend}
            aria-label="Gửi tin nhắn"
            className="rounded-full"
          >
            <ArrowUp />
          </Button>
        </span>
      </div>
    </form>
  );
}
