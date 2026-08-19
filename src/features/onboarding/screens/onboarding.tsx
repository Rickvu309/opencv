import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Checkbox } from "@/ui/checkbox";
import { Loader } from "@/ui/loader";
import { completeOnboardingFn } from "@/features/onboarding/queries";

const linkKinds = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "github", label: "GitHub" },
  { id: "portfolio", label: "Portfolio" },
] as const;

type LinkKind = (typeof linkKinds)[number]["id"];

export function OnboardingScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [targetRole, setTargetRole] = useState("");
  const [unsure, setUnsure] = useState(false);
  const [school, setSchool] = useState("");
  const [major, setMajor] = useState("");
  const [year, setYear] = useState("");
  const [org, setOrg] = useState("");
  const [role, setRole] = useState("");
  const [linkKind, setLinkKind] = useState<LinkKind | "">("");
  const [linkUrl, setLinkUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function finish() {
    if (pending) return;
    setPending(true);
    setSaveError(null);
    try {
      await completeOnboardingFn({
        data: {
          targetRole: unsure ? null : targetRole || null,
          school,
          major,
          year,
          org,
          role,
          linkKind: linkKind || (linkUrl ? "portfolio" : undefined),
          linkUrl,
        },
      });
      await navigate({ to: "/coach" });
    } catch {
      setSaveError("Couldn't save. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-12">
      <p className="text-[13px] text-ink-muted tabular-nums">{step + 1} of 4</p>
      {step === 0 ? (
        <section className="mt-4">
          <h1 className="text-balance text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
            What are you aiming for?
          </h1>
          <Label className="mt-6" htmlFor="goal">
            Target role
          </Label>
          <Input
            id="goal"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            disabled={unsure}
          />
          <label className="mt-3 flex min-h-[var(--size-touch)] items-center gap-2 text-[13px]">
            <Checkbox
              id="unsure"
              checked={unsure}
              onCheckedChange={(value) => setUnsure(value === true)}
              aria-label="I'm not sure yet"
            />
            I&apos;m not sure yet
          </label>
          <p className={`mt-4 text-[13px] leading-[1.5] text-ink-muted ${unsure || targetRole ? "payback-enter" : ""}`}>
            {unsure
              ? "That stays on your profile as not sure yet."
              : targetRole
                ? `This goes on your profile as the goal: ${targetRole}.`
                : "Your goal will sit on the profile and feed Search."}
          </p>
        </section>
      ) : null}
      {step === 1 ? (
        <section className="mt-4">
          <h1 className="text-balance text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
            Where are you now?
          </h1>
          <div className="mt-6 space-y-3">
            <div>
              <Label htmlFor="school">School</Label>
              <Input id="school" value={school} onChange={(e) => setSchool(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="major">Major</Label>
              <Input id="major" value={major} onChange={(e) => setMajor(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="year">Year</Label>
              <Input id="year" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
          </div>
          <p className={`mt-4 text-[13px] leading-[1.5] text-ink-muted ${school ? "payback-enter" : ""}`}>
            {school
              ? `Education on the profile: ${[school, major, year].filter(Boolean).join(" · ")}.`
              : "School, major, and year fill the education section."}
          </p>
        </section>
      ) : null}
      {step === 2 ? (
        <section className="mt-4">
          <h1 className="text-balance text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
            What do you already have?
          </h1>
          <p className="mt-2 text-[13px] text-ink-muted">One job, project, or shift is enough.</p>
          <div className="mt-6 space-y-3">
            <div>
              <Label htmlFor="org">Organisation</Label>
              <Input id="org" value={org} onChange={(e) => setOrg(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="link-url">A link, if you have one</Label>
              <Input
                id="link-url"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
            {linkUrl ? (
              <fieldset>
                <legend className="mb-1 text-[13px] font-[510]">What kind of link</legend>
                <div className="flex flex-wrap gap-1">
                  {linkKinds.map((kind) => (
                    <button
                      key={kind.id}
                      type="button"
                      aria-pressed={linkKind === kind.id}
                      onClick={() => setLinkKind(kind.id)}
                      className={
                        linkKind === kind.id
                          ? "inline-flex min-h-10 items-center rounded-[var(--radius-control)] bg-surface-3 px-3 text-[13px] text-accent"
                          : "inline-flex min-h-10 items-center rounded-[var(--radius-control)] px-3 text-[13px] text-ink-muted hover:bg-surface-2"
                      }
                    >
                      {kind.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </div>
          <p className={`mt-4 text-[13px] leading-[1.5] text-ink-muted ${org || linkUrl ? "payback-enter" : ""}`}>
            {org
              ? `Experience on the profile: ${role || "Member"} at ${org}.`
              : linkUrl
                ? "The link lands on the profile."
                : "This becomes the first experience row."}
          </p>
        </section>
      ) : null}
      {step === 3 ? (
        <section className="mt-4">
          <h1 className="text-balance text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
            The Coach works with you
          </h1>
          <p className="mt-4 leading-[1.6]">
            It can draft and edit in the app. Every change shows up with undo. You stay in control.
          </p>
          <p className="mt-4 text-[13px] leading-[1.5] text-ink-muted">
            {[
              unsure ? "Goal: not sure yet" : targetRole ? `Goal: ${targetRole}` : null,
              school ? `School: ${school}` : null,
              org ? `${role || "Member"} at ${org}` : null,
              linkUrl ? "A link on the profile" : null,
            ]
              .filter(Boolean)
              .join(". ") || "You can skip and fill the profile later."}
          </p>
        </section>
      ) : null}
      {saveError ? (
        <p className="mt-6 text-[13px] text-destructive" role="alert">
          {saveError}
        </p>
      ) : null}
      <div className="mt-10 flex gap-3">
        {step < 3 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={pending}>
            Continue
          </Button>
        ) : (
          <Button onClick={() => void finish()} disabled={pending}>
            {pending ? <Loader label="Saving" /> : null}
            {saveError ? "Try again" : "Go to the Coach"}
          </Button>
        )}
        <Button variant="ghost" onClick={() => void finish()} disabled={pending}>
          {pending ? <Loader label="Saving" /> : null}
          Skip
        </Button>
      </div>
    </main>
  );
}
