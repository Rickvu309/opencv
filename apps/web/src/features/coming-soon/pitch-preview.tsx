export function PitchPreview() {
  return (
    <div aria-hidden="true" className="flex flex-col">
      <div className="flex h-10 items-center gap-1.5 border-b border-border bg-muted/50 px-4">
        <span className="size-2 rounded-full bg-muted-foreground/50" />
        <span className="size-2 rounded-full bg-muted-foreground/50" />
        <span className="size-2 rounded-full bg-muted-foreground/50" />
        <span className="ml-3 min-w-0 flex-1 truncate rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
          opencv.me/u/linh-nguyen
        </span>
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-3">
        <div className="flex flex-col gap-4 sm:col-span-2">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground">
              LN
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                Linh Nguyen
              </span>
              <span className="truncate text-xs text-muted-foreground">
                Marketing, Ho Chi Minh City
              </span>
            </span>
          </div>
          <p className="text-sm text-foreground">
            I listen to buyers, then write content that sells.
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>Download CV</span>
            <span>Email</span>
            <span>LinkedIn</span>
          </div>
          <div className="space-y-3">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              Proof of work
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-sm font-medium">Followers +38%</p>
                <div className="mt-3 flex h-10 items-end gap-1">
                  {["h-3", "h-4", "h-5", "h-6", "h-8", "h-10"].map(
                    (height, index) => (
                      <span
                        key={index}
                        className={`flex-1 rounded-sm bg-muted ${height}`}
                      />
                    )
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="flex h-10 items-end gap-1">
                  {["h-4", "h-6", "h-5", "h-8", "h-7", "h-10"].map(
                    (height, index) => (
                      <span
                        key={index}
                        className={`flex-1 rounded-sm bg-muted ${height}`}
                      />
                    )
                  )}
                </div>
                <p className="mt-3 text-sm font-medium">52% open rate</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:col-span-1 sm:pt-20">
          <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
            <span className="mb-2 flex size-8 items-center justify-center rounded-full bg-muted font-medium">
              HT
            </span>
            <span className="block text-sm text-foreground">
              Hanh Tran opened your Pitch
            </span>
            <span>Just now</span>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold">24</span>
              <span className="text-xs text-muted-foreground">views</span>
            </div>
            <div className="mt-3 flex h-8 items-end gap-1">
              {["h-2", "h-3", "h-2", "h-5", "h-4", "h-6", "h-8"].map(
                (height, index) => (
                  <span
                    key={index}
                    className={`flex-1 rounded-sm bg-muted ${height}`}
                  />
                )
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">3 CV downloads</p>
        </div>
      </div>
    </div>
  )
}
