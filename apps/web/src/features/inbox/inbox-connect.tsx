import { Button } from "@workspace/ui/components/button"

export function InboxConnect({
  url,
  pending,
  onSkip,
}: {
  url: string | null
  pending: boolean
  onSkip: () => void
}) {
  const closed = url == null
  return (
    <div className="grid min-h-0 flex-1 xl:grid-cols-2">
      <section className="flex flex-col justify-center gap-8 px-6 py-10 sm:px-10 lg:px-14">
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            Never miss a recruiter reply
          </h2>
          <p data-user-content className="text-sm text-muted-foreground">
            Job emails, matched to your applications.
          </p>
        </div>
        <div className="flex flex-col gap-5">
          <div className="space-y-1">
            <p className="text-sm font-medium">Replies, sorted.</p>
            <p className="text-sm text-muted-foreground">
              Recruiter emails land here, not lost in Promotions.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Board stays current.</p>
            <p className="text-sm text-muted-foreground">
              Invites move jobs to Live. Rejections close them.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Follow-ups, written.</p>
            <p className="text-sm text-muted-foreground">
              Send a ready follow-up in one click.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="glow"
            disabled={closed}
            aria-describedby={closed ? "inbox-gmail-hint" : undefined}
            onClick={() => {
              if (url) window.location.assign(url)
            }}
          >
            Connect Gmail
          </Button>
          <Button variant="ghost" disabled={pending} onClick={onSkip}>
            Skip for now
          </Button>
        </div>
        <p data-user-content className="text-xs text-muted-foreground">
          Reads job emails only. Nothing is sent without you.
        </p>
        {closed ? (
          <p id="inbox-gmail-hint" className="text-sm text-muted-foreground">
            Gmail is not connected on this server. You can skip for now.
          </p>
        ) : null}
      </section>
      <aside className="hidden min-h-0 items-center justify-center border-l border-border bg-muted/30 p-8 xl:flex">
        <div className="w-full max-w-lg space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-medium">
                HT
              </span>
              <div>
                <p className="text-sm font-medium">Hanh Tran</p>
                <p className="text-xs text-muted-foreground">
                  Recruiter, Regional bank
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm">
              Can you do a 20 minute call on Thursday afternoon?
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">Interview request</p>
            <p className="mt-1 text-sm font-medium">Business Analyst</p>
            <p className="text-sm text-muted-foreground">Regional bank</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Sent</span>
              <span aria-hidden="true">→</span>
              <span className="font-medium text-foreground">Live</span>
              <span className="ml-auto">Moved automatically</span>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">
              Reply drafted for you
            </p>
            <p className="mt-2 text-sm">
              Hi Hanh, Thursday at 14:30 works for me. Best, Linh
            </p>
            <div className="mt-4 flex justify-end gap-2 text-xs text-muted-foreground">
              <span>Edit</span>
              <span>Send</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
