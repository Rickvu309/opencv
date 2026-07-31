"use client";

import Link from "next/link";
import { Rewind } from "lucide-react";

import { CopilotTag } from "@/components/shared/copilot-tag";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Home's prompt into Rewind, the connected weekly review promoted to its own
 * route. Unlike the dialog it replaced, this is a plain link: Rewind is a
 * full surface you land on and can revisit, not a one-shot flow to finish
 * before the banner disappears.
 */
export function RewindBanner() {
  return (
    <Card className="ring-foreground/8 bg-indigo-50/40 dark:bg-indigo-500/5">
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Rewind className="size-3.5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-foreground">This week&rsquo;s Rewind is ready</p>
              <CopilotTag />
            </div>
            <p className="text-xs text-muted-foreground">
              The story of your week, what&rsquo;s worth keeping, and what carries into next week.
            </p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href="/rewind">Open Rewind</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
