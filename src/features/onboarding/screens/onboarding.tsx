import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { completeOnboardingFn } from "@/features/onboarding/queries";

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

  async function finish() {
    await completeOnboardingFn({
      data: {
        targetRole: unsure ? null : targetRole || null,
        school,
        major,
        year,
        org,
        role,
      },
    });
    await navigate({ to: "/coach" });
  }

  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-12">
      <p className="text-ink-muted tabular-nums">Step {step + 1} of 4</p>
      {step === 0 ? (
        <section className="mt-4">
          <h1 className="text-balance text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
            What are you aiming for?
          </h1>
          <Label className="mt-6" htmlFor="goal">
            Target role
          </Label>
          <Input id="goal" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} disabled={unsure} />
          <label className="mt-3 flex min-h-11 items-center gap-2 text-[13px]">
            <input type="checkbox" checked={unsure} onChange={(e) => setUnsure(e.target.checked)} />
            I'm not sure yet
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
          </div>
          <p className={`mt-4 text-[13px] leading-[1.5] text-ink-muted ${org ? "payback-enter" : ""}`}>
            {org
              ? `Experience on the profile: ${role || "Member"} at ${org}.`
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
            ]
              .filter(Boolean)
              .join(". ") || "You can skip and fill the profile later."}
          </p>
        </section>
      ) : null}
      <div className="mt-10 flex gap-3">
        {step < 3 ? (
          <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
        ) : (
          <Button onClick={() => void finish()}>Go to the Coach</Button>
        )}
        <Button variant="ghost" onClick={() => void finish()}>
          Skip
        </Button>
      </div>
    </main>
  );
}
