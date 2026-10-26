import { Button } from "@workspace/ui/components/button"

const PROMISE = [
  "Job emails, matched to your applications.",
  "Replies, sorted.",
  "Recruiter emails land here, not lost in Promotions.",
  "Board stays current.",
  "Invites move jobs to Interview.",
  "Rejections close them.",
  "Follow-ups, written.",
  "Send a ready follow-up in one click.",
]

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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-medium">Never miss a recruiter reply</h2>
        <p data-user-content className="text-sm text-muted-foreground">
          Reads job emails only. Nothing is sent without you.
        </p>
      </div>
      <ul data-user-content className="flex flex-col gap-1 text-sm">
        {PROMISE.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div
        data-user-content
        className="rounded-lg border border-border bg-card p-4 text-sm"
      >
        <p className="font-medium">Interview request</p>
        <p className="text-muted-foreground">Linked to your application</p>
        <p>Business Analyst</p>
        <p className="text-muted-foreground">Regional bank</p>
        <p>Applied. Interview. Moved automatically.</p>
        <p>Reply drafted for you.</p>
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
      {closed ? (
        <p id="inbox-gmail-hint" className="text-sm text-muted-foreground">
          Gmail is not connected on this server. You can skip for now.
        </p>
      ) : null}
    </div>
  )
}
