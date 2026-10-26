export function PitchPreview() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4 px-6 py-5">
      <p className="text-xs text-muted-foreground">opencv.me/u/linh-nguyen</p>
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
      <p className="text-xs tracking-wide text-muted-foreground uppercase">
        Proof of work
      </p>
      <p className="text-sm text-foreground">Followers +38%</p>
      <p className="text-sm text-foreground">52% open rate</p>
      <div className="flex items-center gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
          HT
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm text-foreground">
            Hanh Tran opened your Pitch
          </span>
          <span className="text-xs text-muted-foreground">Just now</span>
        </span>
      </div>
      <p className="text-sm text-foreground">3 CV downloads</p>
      <p className="text-sm text-muted-foreground">
        <span className="text-lg font-medium text-foreground">24</span> views
      </p>
    </div>
  )
}
