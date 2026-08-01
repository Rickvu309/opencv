import { Skeleton } from "@/components/ui/skeleton";

/**
 * Reserved space for a showcase composition before it lazy-mounts (bundle
 * discipline, brief section 3): matches the framed shell's own chrome so
 * nothing shifts height once the real component swaps in.
 */
export function ShowcaseSkeleton({ heightPx }: { heightPx: number }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10" style={{ height: heightPx + 45 }}>
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3.5 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-muted-foreground/20" />
          <span className="size-2.5 rounded-full bg-muted-foreground/20" />
          <span className="size-2.5 rounded-full bg-muted-foreground/20" />
        </div>
        <Skeleton className="h-5 flex-1 rounded-md" />
      </div>
      <div className="flex flex-col gap-3 p-5" style={{ height: heightPx }}>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}
