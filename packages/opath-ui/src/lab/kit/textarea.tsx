import type * as React from "react";

import { cn } from "../../cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full resize-none rounded-[var(--radius-control)] border border-hairline bg-surface-1 px-3 py-2 text-[15px] leading-[1.6] text-ink outline-none placeholder:text-ink-faint focus-visible:border-accent focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      data-slot="textarea"
      {...props}
    />
  );
}

export { Textarea };
