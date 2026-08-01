/**
 * Minimal footer per the brief: product name and the studio credit, no
 * fake nav links (nothing here to click through to, on purpose).
 */
export function MarketingFooter() {
  return (
    <footer className="border-t border-border px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-1 text-center">
        <span className="text-sm font-semibold text-foreground">OpenPath</span>
        <span className="text-xs text-muted-foreground">A design prototype by Red Dog Studio.</span>
      </div>
    </footer>
  );
}
