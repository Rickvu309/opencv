"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { CoachCat } from "@/components/brand/coach-cat";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { messages } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

const destinations = [
  { href: "/coach", label: messages.nav.coach, cat: true },
  { href: "/profile", label: messages.nav.profile },
  { href: "/cv", label: messages.nav.cv },
  { href: "/papers", label: messages.nav.papers },
  { href: "/pitch", label: messages.nav.pitch },
  { href: "/search", label: messages.nav.search },
  { href: "/applications", label: messages.nav.applications },
  { href: "/help", label: messages.nav.support },
] as const;

/**
 * Linear/Raycast jump list. The header search button advertised ⌘K and did
 * nothing; this is the thing it promised.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { t } = useT();
  const [query, setQuery] = React.useState("");

  const shown = destinations.filter((item) =>
    t(item.label).toLowerCase().includes(query.trim().toLowerCase()),
  );

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[20%] max-w-md translate-y-0 gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">{t(messages.common.commandPalette)}</DialogTitle>
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t(messages.common.commandHint)}
          className="h-11 rounded-none border-0 border-b text-base shadow-none focus-visible:ring-0 sm:text-sm"
        />
        <ul className="max-h-72 overflow-y-auto p-1">
          {shown.map((item) => (
            <li key={item.href}>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  router.push(item.href);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm",
                  "hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none",
                )}
              >
                {"cat" in item ? (
                  <CoachCat size="sm" />
                ) : (
                  <span className="size-3.5" />
                )}
                {t(item.label)}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { open, setOpen };
}
