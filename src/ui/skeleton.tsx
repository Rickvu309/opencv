export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`skeleton-pulse rounded-[var(--radius-control)] bg-surface-2 ${className ?? "h-11"}`}
    />
  );
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-hairline" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex min-h-[var(--size-touch)] items-center gap-3 py-3">
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

export function SkeletonPage() {
  return (
    <div className="-mx-5 bg-surface-2 px-5 py-8" aria-busy="true" aria-label="Loading">
      <SkeletonBlock className="mx-auto h-[80vh] max-w-[210mm] rounded-none" />
    </div>
  );
}

export function SkeletonThread({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 py-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className={i % 2 === 0 ? "ml-auto h-16 w-2/3" : "h-20 w-5/6"}
        />
      ))}
    </div>
  );
}

export function SkeletonHistory({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1" aria-busy="true" aria-label="Loading conversations">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

