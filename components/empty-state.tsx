import Link from "next/link";

import { CoachBox } from "@/components/brand/coach-box";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Empty is an invitation. The box sits; the copy names the place and the
 * one next move. First visit only gets a 300ms settle — never again that session.
 */
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-6 rounded-xl border bg-card px-5 py-8",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-[var(--duration-surface)] motion-safe:ease-enter motion-safe:fill-mode-backwards",
        className,
      )}
    >
      <CoachBox size="lg" className="text-foreground" />
      <p className="mt-4 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm text-pretty text-muted-foreground">
        {body}
      </p>
      {action ? (
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
