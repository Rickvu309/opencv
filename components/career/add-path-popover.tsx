"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { stages, type StageId } from "@/lib/career-graph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

/** Add your own path, wired from the selected node. */
export function AddPathPopover({
  fromId,
  fromTitle,
  onAdd,
}: {
  fromId: string;
  fromTitle: string;
  onAdd: (title: string, stage: StageId, fromId: string) => void;
}) {
  const { t, m } = useT();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [stage, setStage] = React.useState<StageId>("core");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t, stage, fromId);
    setTitle("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <Plus className="size-3.5" />
          {t(m.map.addPath)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <form onSubmit={submit}>
          <div className="grid gap-3 p-3">
            <div className="grid gap-1.5">
              <Label htmlFor="np-title">{t(m.map.addPathRoleName)}</Label>
              <Input
                id="np-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t(m.map.addPathRolePlaceholder)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t(m.map.addPathColumn)}</Label>
              <div className="flex flex-wrap gap-1">
                {stages
                  .filter((s) => s.id !== "now")
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStage(s.id)}
                      aria-pressed={stage === s.id}
                      className={cn(
                        "h-7 rounded-md border px-2 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                        stage === s.id
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "bg-card text-muted-foreground hover:bg-muted/60",
                      )}
                    >
                      {t(s.label)}
                    </button>
                  ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(m.map.addPathFrom(fromTitle))}
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t bg-muted/40 px-3 py-2.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              {t(m.common.cancel)}
            </Button>
            <Button type="submit" size="sm" disabled={!title.trim()}>
              {t(m.map.addPathSubmit)}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
