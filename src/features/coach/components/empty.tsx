import { useEffect, useState, type ReactNode } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Mark } from "@/ui/mark";
import { Button } from "@/ui/button";
import { SuggestionList } from "@/ui/suggestion-list";

const EMAIL_BANNER_KEY = "openpath.email-connect-dismissed";

export function coachStarters(targetRole?: string | null) {
  const role = targetRole?.trim();
  if (role) {
    return [
      { id: "cv", label: `Start a CV for ${role}` },
      { id: "fit", label: `What openings fit ${role}` },
      { id: "letter", label: "Draft a cover letter" },
    ];
  }
  return [
    { id: "cv", label: "Start a CV" },
    { id: "fit", label: "What openings fit" },
    { id: "letter", label: "Draft a cover letter" },
  ];
}

export function CoachEmpty({
  composer,
  starters,
  onStarter,
}: {
  composer: ReactNode;
  starters?: { id: string; label: string }[];
  onStarter?: (label: string) => void;
}) {
  return (
    <div data-empty-thread className="flex min-h-0 flex-1 flex-col items-center justify-center">
      <div className="flex w-full max-w-2xl flex-col items-center">
        <Mark className="size-10 text-ink" />
        <div className="mt-8 w-full">{composer}</div>
        {starters?.length && onStarter ? (
          <SuggestionList className="mt-6" items={starters} onPick={(_id, label) => onStarter(label)} />
        ) : null}
        <EmailConnectBanner />
      </div>
    </div>
  );
}

function EmailConnectBanner() {
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(EMAIL_BANNER_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden !== false) return null;

  function dismiss() {
    try {
      localStorage.setItem(EMAIL_BANNER_KEY, "1");
    } catch {
      /* private mode */
    }
    setHidden(true);
  }

  return (
    <div className="mt-6 flex w-full flex-col gap-3 rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-3 sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink">
        <Mail className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[15px] font-[510] leading-[1.5]">Connect your email</p>
        <p className="mt-0.5 text-[13px] leading-[1.5] text-ink-muted">
          Drafts and follows up on application emails.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
          Dismiss
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => toast("Email connect is not available yet.")}
        >
          Connect
        </Button>
      </div>
    </div>
  );
}
