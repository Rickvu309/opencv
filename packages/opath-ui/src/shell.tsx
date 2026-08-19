export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[var(--z-skip)] focus:rounded-[var(--radius-control)] focus:border focus:border-hairline focus:bg-surface-1 focus:px-3 focus:py-2 focus:text-[13px] focus:shadow-[var(--shadow-overlay)]"
    >
      Skip to content
    </a>
  );
}
