export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-[var(--radius-control)] bg-muted ${className ?? "h-11"}`} />;
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-border" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex min-h-11 items-center gap-3 py-3">
          <SkeletonBlock className="h-4 w-2/5" />
          <SkeletonBlock className="ml-auto h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonSection() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <SkeletonBlock className="h-5 w-32" />
      <SkeletonBlock className="h-11 w-full" />
      <SkeletonBlock className="h-11 w-full" />
    </div>
  );
}
