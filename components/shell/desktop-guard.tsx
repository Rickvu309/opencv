import type { ReactNode } from "react";
import { Monitor } from "lucide-react";

/**
 * OpenPath is a desktop-only prototype. Below the 1024px breakpoint we
 * show a polite notice instead of a squeezed layout. Pure CSS, no JS: both
 * branches render, Tailwind's `lg:` breakpoint decides which is visible.
 */
export function DesktopGuard({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="hidden min-h-0 flex-1 lg:flex">{children}</div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-8 text-center lg:hidden">
        <Monitor className="size-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">OpenPath is a desktop product</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The workspace, the Copilot panel, and the navigation all need room to work together. Open OpenPath on a
          laptop or desktop browser at least 1024 pixels wide.
        </p>
      </div>
    </>
  );
}
