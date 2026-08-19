import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Checkbox } from "@/ui/checkbox";
import { Loader } from "@/ui/loader";
import { Card } from "@/ui/card";
import { cn } from "@/lib/utils";

export const linkKinds = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "github", label: "GitHub" },
  { id: "portfolio", label: "Portfolio" },
] as const;

export type LinkKind = (typeof linkKinds)[number]["id"];

export type OnboardingValues = {
  step: number;
  targetRole: string;
  unsure: boolean;
  school: string;
  major: string;
  year: string;
  org: string;
  role: string;
  linkKind: LinkKind | "";
  linkUrl: string;
  pending: boolean;
  saveError: string | null;
};

const steps = [
  { id: 0, label: "Goal" },
  { id: 1, label: "School" },
  { id: 2, label: "Work" },
  { id: 3, label: "Coach" },
] as const;

export function OnboardingWizard({
  values,
  onChange,
  onContinue,
  onSkip,
  onFinish,
}: {
  values: OnboardingValues;
  onChange: (patch: Partial<OnboardingValues>) => void;
  onContinue: () => void;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const { step } = values;
  const payback = paybackLines(values);

  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-12">
      <ol className="flex gap-1" aria-label="Onboarding steps">
        {steps.map((item) => (
          <li key={item.id} className="min-w-0 flex-1">
            <span
              className={cn(
                "block h-1 rounded-full",
                item.id <= step ? "bg-accent" : "bg-surface-3",
              )}
            />
            <span
              className={cn(
                "mt-2 block text-[12px] leading-[1.5]",
                item.id === step ? "font-[510] text-ink" : "text-ink-faint",
              )}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[13px] text-ink-muted tabular-nums">
        {step + 1} of 4
      </p>

      {step === 0 ? <GoalStep values={values} onChange={onChange} /> : null}
      {step === 1 ? <SchoolStep values={values} onChange={onChange} /> : null}
      {step === 2 ? <WorkStep values={values} onChange={onChange} /> : null}
      {step === 3 ? <CoachStep values={values} /> : null}

      <Card className={cn("mt-6 bg-surface-2 p-4", payback.length ? "payback-enter" : "")}>
        <p className="text-[13px] font-[510] text-ink">On your profile</p>
        {payback.length ? (
          <ul className="mt-2 space-y-1">
            {payback.map((line) => (
              <li key={line} className="text-[13px] leading-[1.5] text-ink-muted">
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] leading-[1.5] text-ink-muted">
            Answers land here as you go. Skip is always available.
          </p>
        )}
      </Card>

      {values.saveError ? (
        <p className="mt-6 text-[13px] text-destructive" role="alert">
          {values.saveError}
        </p>
      ) : null}
      <div className="mt-10 flex gap-3">
        {step < 3 ? (
          <Button onClick={onContinue} disabled={values.pending}>
            Continue
          </Button>
        ) : (
          <Button onClick={onFinish} disabled={values.pending}>
            {values.pending ? <Loader label="Saving" /> : null}
            {values.saveError ? "Try again" : "Go to the Coach"}
          </Button>
        )}
        <Button variant="ghost" onClick={onSkip} disabled={values.pending}>
          {values.pending ? <Loader label="Saving" /> : null}
          Skip
        </Button>
      </div>
    </main>
  );
}

function paybackLines(values: OnboardingValues): string[] {
  const lines: string[] = [];
  if (values.unsure) lines.push("Goal: not sure yet");
  else if (values.targetRole) lines.push(`Goal: ${values.targetRole}`);
  if (values.school) {
    lines.push(`Education: ${[values.school, values.major, values.year].filter(Boolean).join(" · ")}`);
  }
  if (values.org) lines.push(`Experience: ${values.role || "Member"} at ${values.org}`);
  if (values.linkUrl) lines.push("A link on the profile");
  return lines;
}

function GoalStep({
  values,
  onChange,
}: {
  values: OnboardingValues;
  onChange: (patch: Partial<OnboardingValues>) => void;
}) {
  return (
    <section className="mt-4">
      <h1 className="text-balance text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
        What are you aiming for?
      </h1>
      <Label className="mt-6" htmlFor="goal">
        Target role
      </Label>
      <Input
        id="goal"
        value={values.targetRole}
        onChange={(e) => onChange({ targetRole: e.target.value })}
        disabled={values.unsure}
      />
      <label className="mt-3 flex min-h-[var(--size-touch)] items-center gap-2 text-[13px]">
        <Checkbox
          id="unsure"
          checked={values.unsure}
          onCheckedChange={(value) => onChange({ unsure: value === true })}
          aria-label="I'm not sure yet"
        />
        I&apos;m not sure yet
      </label>
      <p
        className={cn(
          "mt-4 text-[13px] leading-[1.5] text-ink-muted",
          values.unsure || values.targetRole ? "payback-enter" : "",
        )}
      >
        {values.unsure
          ? "That stays on your profile as not sure yet."
          : values.targetRole
            ? `This goes on your profile as the goal: ${values.targetRole}.`
            : "Your goal will sit on the profile and feed Search."}
      </p>
    </section>
  );
}

function SchoolStep({
  values,
  onChange,
}: {
  values: OnboardingValues;
  onChange: (patch: Partial<OnboardingValues>) => void;
}) {
  return (
    <section className="mt-4">
      <h1 className="text-balance text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
        Where are you now?
      </h1>
      <div className="mt-6 space-y-3">
        <div>
          <Label htmlFor="school">School</Label>
          <Input
            id="school"
            value={values.school}
            onChange={(e) => onChange({ school: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="major">Major</Label>
          <Input
            id="major"
            value={values.major}
            onChange={(e) => onChange({ major: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="year">Year</Label>
          <Input
            id="year"
            value={values.year}
            onChange={(e) => onChange({ year: e.target.value })}
          />
        </div>
      </div>
      <p
        className={cn(
          "mt-4 text-[13px] leading-[1.5] text-ink-muted",
          values.school ? "payback-enter" : "",
        )}
      >
        {values.school
          ? `Education on the profile: ${[values.school, values.major, values.year].filter(Boolean).join(" · ")}.`
          : "School, major, and year fill the education section."}
      </p>
    </section>
  );
}

function WorkStep({
  values,
  onChange,
}: {
  values: OnboardingValues;
  onChange: (patch: Partial<OnboardingValues>) => void;
}) {
  return (
    <section className="mt-4">
      <h1 className="text-balance text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
        What do you already have?
      </h1>
      <p className="mt-2 text-[13px] text-ink-muted">One job, project, or shift is enough.</p>
      <div className="mt-6 space-y-3">
        <div>
          <Label htmlFor="org">Organisation</Label>
          <Input id="org" value={values.org} onChange={(e) => onChange({ org: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <Input
            id="role"
            value={values.role}
            onChange={(e) => onChange({ role: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="link-url">A link, if you have one</Label>
          <Input
            id="link-url"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={values.linkUrl}
            onChange={(e) => onChange({ linkUrl: e.target.value })}
          />
        </div>
        {values.linkUrl ? (
          <fieldset>
            <legend className="mb-1 text-[13px] font-[510]">What kind of link</legend>
            <div className="flex flex-wrap gap-1">
              {linkKinds.map((kind) => (
                <button
                  key={kind.id}
                  type="button"
                  aria-pressed={values.linkKind === kind.id}
                  onClick={() => onChange({ linkKind: kind.id })}
                  className={
                    values.linkKind === kind.id
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
      <p
        className={cn(
          "mt-4 text-[13px] leading-[1.5] text-ink-muted",
          values.org || values.linkUrl ? "payback-enter" : "",
        )}
      >
        {values.org
          ? `Experience on the profile: ${values.role || "Member"} at ${values.org}.`
          : values.linkUrl
            ? "The link lands on the profile."
            : "This becomes the first experience row."}
      </p>
    </section>
  );
}

function CoachStep({ values }: { values: OnboardingValues }) {
  const summary =
    [
      values.unsure ? "Goal: not sure yet" : values.targetRole ? `Goal: ${values.targetRole}` : null,
      values.school ? `School: ${values.school}` : null,
      values.org ? `${values.role || "Member"} at ${values.org}` : null,
      values.linkUrl ? "A link on the profile" : null,
    ]
      .filter(Boolean)
      .join(". ") || "You can skip and fill the profile later.";

  return (
    <section className="mt-4">
      <h1 className="text-balance text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
        The Coach works with you
      </h1>
      <p className="mt-4 leading-[1.6]">
        It can draft and edit in the app. Every change shows up with undo. You stay in control.
      </p>
      <p className="mt-4 text-[13px] leading-[1.5] text-ink-muted">{summary}</p>
    </section>
  );
}
