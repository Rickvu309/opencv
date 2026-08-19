import { cn } from "./cn";

export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("size-5 shrink-0 fill-none stroke-current", className)}
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M2.5 7.75 8 2.25l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 13.5 8 8l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
