"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PenLine, Search } from "lucide-react";

import { conversations, type Conversation } from "@/lib/data";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Group by day bucket, preserving data order. */
function groupConversations(query: string) {
  const q = query.trim().toLowerCase();
  const groups: { label: string; items: Conversation[] }[] = [];
  for (const c of conversations) {
    if (q && !c.title.toLowerCase().includes(q)) continue;
    const found = groups.find((g) => g.label === c.group);
    if (found) found.items.push(c);
    else groups.push({ label: c.group, items: [c] });
  }
  return groups;
}

/**
 * Conversation history in a popover, like Linear's "New chat ▾": a search
 * field, a day-grouped list, and a row to start a new chat. Shared by the
 * header chat switcher and the bottom-right coach strip.
 */
export function ChatHistoryPopover({
  trigger,
  align = "start",
  side = "bottom",
}: {
  trigger: React.ReactNode;
  align?: "start" | "end";
  side?: "top" | "bottom";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const groups = groupConversations(query);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={6}
        className="w-80 p-0"
      >
        <label className="flex cursor-text items-center gap-2 border-b px-3 py-2.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="sr-only">Tìm hội thoại</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm hội thoại"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
          />
        </label>

        <div className="max-h-80 overflow-y-auto py-1">
          {groups.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Không tìm thấy hội thoại nào
            </p>
          )}
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => go("/coach")}
                  className="flex h-8 w-full items-center gap-3 px-3 text-left text-sm transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60 motion-reduce:transition-none"
                >
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {c.when}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="border-t p-1">
          <button
            type="button"
            onClick={() => go("/coach?new=1")}
            className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-sm transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60 motion-reduce:transition-none"
          >
            <PenLine className="size-3.5 text-muted-foreground" />
            Đoạn chat mới
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
