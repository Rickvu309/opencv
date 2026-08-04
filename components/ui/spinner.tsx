import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const spinnerVariants = cva("shrink-0", {
  variants: {
    size: {
      sm: "size-3.5",
      md: "size-5",
      lg: "size-8",
    },
  },
  defaultVariants: { size: "md" },
});

/**
 * Two-tone ring: a full-circle track with a rotating arc riding on it.
 * Reduced motion swaps rotation for a breathing opacity so activity still reads.
 */
function Spinner({
  className,
  size,
  label = "Đang tải",
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof spinnerVariants> & { label?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center", className)}
      {...props}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className={cn(
          spinnerVariants({ size }),
          "motion-safe:animate-spin motion-reduce:animate-pulse",
        )}
      >
        <circle
          cx="12"
          cy="12"
          r="9.5"
          stroke="currentColor"
          strokeWidth="2.5"
          className="opacity-15"
        />
        <path
          d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Ba chấm cho trạng thái coach đang soạn câu trả lời. */
function TypingDots({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className="size-1.5 rounded-full bg-current opacity-50 motion-safe:animate-bounce motion-reduce:animate-pulse"
          style={{ animationDelay: `${i * 0.15 - 0.3}s` }}
        />
      ))}
      <span className="sr-only">Coach đang soạn câu trả lời</span>
    </span>
  );
}

export { Spinner, TypingDots };
