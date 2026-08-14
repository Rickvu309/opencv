"use client";

// The front door.
//
// ## What this replaces, and why
//
// Four screens that asked, in order: gender and year of birth, then where you
// study, then what documents you own, then — last — what you actually want.
// Ten fields, no validation, nothing required, and not one thing shown back
// until the end. You could press Continue four times and land in the Coach with
// an empty profile, whose first suggestion was then to build a CV out of it.
//
// Three things were wrong, and all three were about the journey rather than the
// markup:
//
//  1. **The order was inverted.** The goal is the only question the visitor
//     arrived with, and it was fourth. Everything before it was asked without a
//     reason they could feel, with the justification in grey in the far corner.
//  2. **Nothing was earned.** No question paid for the next one. A career coach
//     opening with your gender is the coldest possible start.
//  3. **Nothing moved.** The map's fit score was a hardcoded literal, so there
//     was no number for the answers to change even in principle.
//
// So: goal first, then the two questions that make the goal specific, and a
// live fit panel that moves as they type. Six inputs instead of ten. Gender,
// year of birth, GPA and "CV file name" are gone — nothing in the app read the
// first three, and the fourth asked you to type the name of a file on your own
// laptop.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, Compass, Loader2, Route } from "lucide-react";

import { useAppState, useDispatch } from "@/lib/actions/store";
import { pathNodes, stages } from "@/lib/career-graph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { useT } from "@/lib/i18n/use-t";
import { LanguageToggle } from "@/components/language-toggle";
import { FitPanel } from "@/components/onboarding/fit-panel";
import { cn } from "@/lib/utils";
import { markJustOnboarded } from "@/components/waitlist-prompt";

const TOTAL_STEPS = 3;

const pressCta =
  "active:scale-[0.96] transition-transform duration-[var(--duration-press)] ease-snap motion-reduce:transition-none";

// 16px on mobile, matching the shadcn Input/Textarea default: iOS Safari zooms
// the whole page when a focused field's text is smaller than that.
const fieldClass = "h-10 text-base md:text-sm";

/** The answer for someone who genuinely does not know yet, which is most of them. */
const UNSURE = "unsure";

export default function OnboardingPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { profile, locale } = useAppState();
  const { t, m } = useT();
  const [step, setStep] = React.useState(0);

  const steps = [
    { label: m.onboarding.step1Label, headline: m.onboarding.goalHeadline, support: m.onboarding.goalSupport, next: m.onboarding.goalNext },
    { label: m.onboarding.startLabel, headline: m.onboarding.startHeadline, support: m.onboarding.startSupport, next: m.onboarding.startNext },
    { label: m.onboarding.haveLabel, headline: m.onboarding.haveHeadline, support: m.onboarding.haveSupport, next: m.onboarding.finishNext },
  ];

  // Step 1, the goal. `targetNodeId` is a map node, UNSURE, or null while they
  // are typing something the map has no node for.
  const [targetNodeId, setTargetNodeId] = React.useState<string | null>(
    () => pathNodes.find((n) => n.title === profile.identity.targetRole)?.id ?? null,
  );
  const [targetRole, setTargetRole] = React.useState(profile.identity.targetRole);

  // Step 2, where they are starting from.
  const [name, setName] = React.useState(profile.identity.name);
  const [school, setSchool] = React.useState(profile.education.school);
  const [major, setMajor] = React.useState(profile.education.major);
  const [year, setYear] = React.useState(profile.education.year);

  // Step 3, what they have already.
  const [courses, setCourses] = React.useState(() =>
    profile.education.courses.join("\n"),
  );

  const [finishing, setFinishing] = React.useState(false);

  const roleGroups = stages
    .filter((stage) => stage.id !== "now")
    .map((stage) => ({
      stage,
      roles: pathNodes.filter((node) => node.stage === stage.id),
    }))
    .filter((group) => group.roles.length > 0);

  // What the fit panel scores against, rebuilt from the draft rather than from
  // the store: the whole point is that it answers before anything is committed.
  const draftProfile = {
    education: {
      major,
      year,
      courses: courses.split("\n").map((c) => c.trim()).filter(Boolean),
    },
    experience: profile.experience,
  };
  const scoredAgainst = targetNodeId === UNSURE ? null : targetNodeId;

  function handleFinish() {
    setFinishing(true);
    const quiet = { silent: true } as const;

    // Blank fields are omitted rather than sent as "", which every schema here
    // rejects with `.min(1)`. Skipping a question has to stay survivable.
    const filled = <T extends Record<string, string>>(fields: T) =>
      Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim()));

    // The goal is one field on the profile now. It used to be written twice,
    // here and on the career map, and keeping the two in step was the reason
    // `path.setTarget` existed. With the map gone there is one place for it.
    const identity = filled({
      name,
      targetRole: targetNodeId === UNSURE ? "" : targetRole,
    });
    if (Object.keys(identity).length > 0) {
      dispatch("profile.setIdentity", identity, quiet);
    }

    const education = filled({ school, major, year });
    if (Object.keys(education).length > 0) {
      dispatch("profile.setEducation", education, quiet);
    }

    for (const course of draftProfile.education.courses) {
      dispatch("profile.addCourse", { name: course }, quiet);
    }

    markJustOnboarded();
    // The Coach doing something is the introduction. A four-card lecture
    // between setup and the product is the thing people skip.
    const question = t(m.onboarding.firstQuestion);
    setTimeout(() => {
      router.push(`/coach?q=${encodeURIComponent(question)}`);
    }, 1200);
  }

  const current = steps[step];
  const headline = t(finishing ? m.onboarding.savingTitle : current.headline);
  const support = t(finishing ? m.onboarding.savingSupport : current.support);
  const chose = targetNodeId !== null || targetRole.trim().length > 0;

  return (
    <div className="flex min-h-svh flex-col lg:h-svh lg:flex-row lg:overflow-hidden">
      {/* Left pane: context */}
      <aside className="flex shrink-0 flex-col gap-5 bg-foreground px-5 py-5 text-background sm:px-8 lg:h-full lg:w-1/2 lg:gap-0 lg:px-12 lg:py-10 xl:px-16">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-background/40"
            >
              <span className="flex size-7 items-center justify-center rounded-lg bg-background text-foreground">
                <Route className="size-4" />
              </span>
              <span className="text-base font-semibold tracking-tight">OpenPath</span>
            </Link>
            <span className="flex items-center gap-2">
              <LanguageToggle className="border-background/25 bg-transparent [&_button]:text-background/70 [&_button[aria-pressed=true]]:bg-background/15 [&_button[aria-pressed=true]]:text-background" />
              <span className="text-[11px] tracking-wide text-background/50 uppercase tabular-nums lg:hidden">
                {t(m.onboarding.stepOf(step + 1, TOTAL_STEPS))}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {steps.map((s, i) => (
              <span
                key={t(s.label)}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-[var(--duration-surface)] ease-enter motion-reduce:transition-none",
                  i <= step || finishing ? "bg-background" : "bg-background/25",
                )}
              />
            ))}
          </div>

          <div className="hidden grid-cols-3 gap-2 lg:grid">
            {steps.map((s, i) => (
              <span
                key={t(s.label)}
                className={cn(
                  "text-[11px] tracking-wide uppercase transition-opacity duration-[var(--duration-surface)] motion-reduce:transition-none",
                  i === step && !finishing ? "opacity-100" : "opacity-50",
                )}
              >
                {t(s.label)}
              </span>
            ))}
          </div>

          <p className="text-[11px] font-medium tracking-wide uppercase lg:hidden">
            {t(current.label)}
          </p>
        </div>

        <div className="hidden min-h-0 flex-1 flex-col justify-center overflow-y-auto lg:flex">
          <div
            key={headline}
            className="animate-in fade-in-0 slide-in-from-bottom-2 duration-[var(--duration-surface)] ease-enter motion-reduce:animate-none"
          >
            <h1 className="max-w-lg text-4xl font-semibold tracking-display text-balance lg:text-5xl">
              {headline}
            </h1>
            <p className="mt-5 max-w-sm text-[15px] leading-7 text-background/70">
              {support}
            </p>
            <div className="mt-8 max-w-sm">
              {!finishing && step === 0 && (
                <FitPanel
                  profile={draftProfile}
                  targetId={scoredAgainst}
                  onDark
                />
              )}
              {!finishing && step === 1 && (
                <PreviewList
                  rows={[
                    { label: t(m.onboarding.name), value: name },
                    { label: t(m.onboarding.school), value: school },
                    { label: t(m.onboarding.major), value: major },
                    { label: t(m.onboarding.year), value: year },
                  ]}
                  empty={t(m.onboarding.previewEmpty)}
                />
              )}
              {!finishing && step === 2 && (
                <div className="grid gap-3">
                  <PreviewList
                    rows={[
                      {
                        label: t(m.onboarding.courses),
                        value: draftProfile.education.courses.join(", "),
                      },
                    ]}
                    empty={t(m.onboarding.previewEmpty)}
                  />
                  <p className="text-xs leading-5 text-background/55">
                    {t(m.onboarding.asideCoachHint)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="hidden text-xs text-background/45 lg:block">
          {t(m.onboarding.privacy)}
        </p>
      </aside>

      {/* Right pane: the questions */}
      <section className="flex flex-1 flex-col bg-background lg:h-full lg:w-1/2 lg:overflow-y-auto">
        <div className="flex min-h-full flex-1 flex-col px-5 py-8 sm:px-8 lg:justify-center lg:px-12 lg:py-14 xl:px-16">
          <div
            key={finishing ? "finishing" : step}
            className="mx-auto w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-2 duration-[var(--duration-surface)] ease-enter motion-reduce:animate-none"
          >
            <div className="mb-7 lg:hidden">
              <h1 className="text-2xl font-semibold tracking-tight text-balance">
                {headline}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{support}</p>
            </div>

            {finishing ? (
              <div className="flex items-center gap-2.5 text-sm font-medium">
                <Loader2 className="size-4 animate-spin" />
                {t(m.onboarding.savingStatus)}
              </div>
            ) : (
              <>
                {/* ── 1. The goal ──────────────────────────────── */}
                {step === 0 && (
                  <div className="grid gap-4">
                    {/* First, because it is the honest answer for most people
                        who open a career app, and it used to have no
                        affordance at all — only a blank text field and a
                        certainty radio three questions later. */}
                    <button
                      type="button"
                      aria-pressed={targetNodeId === UNSURE}
                      onClick={() => {
                        setTargetNodeId(UNSURE);
                        setTargetRole("");
                      }}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                        targetNodeId === UNSURE
                          ? "border-foreground bg-muted"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <Compass className="mt-0.5 size-4 shrink-0" />
                      <span className="grid gap-0.5">
                        <span className="text-sm font-medium">
                          {t(m.onboarding.unsureTitle)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t(m.onboarding.unsureNote)}
                        </span>
                      </span>
                      {targetNodeId === UNSURE && (
                        <Check className="ml-auto size-4 shrink-0" />
                      )}
                    </button>

                    <div className="grid gap-4">
                      {roleGroups.map(({ stage, roles }) => (
                        <div key={stage.id} className="grid gap-1.5">
                          <p className="flex items-baseline justify-between gap-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                            {stage.label[locale]}
                            <span className="font-normal normal-case tabular-nums">
                              {stage.horizon[locale]}
                            </span>
                          </p>
                          <div className="-space-y-px">
                            {roles.map((role) => {
                              const selected = targetNodeId === role.id;
                              return (
                                <button
                                  key={role.id}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() => {
                                    setTargetRole(role.title);
                                    setTargetNodeId(role.id);
                                  }}
                                  className={cn(
                                    "relative flex w-full items-start justify-between gap-3 border px-4 py-2.5 text-left outline-none transition-colors first:rounded-t-xl last:rounded-b-xl focus-visible:z-20 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                                    selected
                                      ? "z-10 border-foreground bg-muted"
                                      : "border-border hover:bg-muted/50",
                                  )}
                                >
                                  <span className="grid min-w-0 gap-0.5">
                                    <span className="text-sm font-medium">
                                      {role.title}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {role.summary[locale]}
                                    </span>
                                  </span>
                                  <span className="flex shrink-0 items-center gap-2">
                                    {/* Pay is context, not the headline. It
                                        used to be the boldest thing on the
                                        row, which sells a number before fit
                                        means anything. */}
                                    {role.salary && (
                                      <span className="text-[11px] whitespace-nowrap text-muted-foreground/70 tabular-nums">
                                        {role.salary[locale]}
                                      </span>
                                    )}
                                    {selected && <Check className="size-4 shrink-0" />}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <Field htmlFor="target-role" label={t(m.onboarding.otherRole)}>
                      <Input
                        id="target-role"
                        placeholder={t(m.onboarding.targetRolePlaceholder)}
                        className={fieldClass}
                        value={targetNodeId === UNSURE ? "" : targetRole}
                        onChange={(e) => {
                          setTargetRole(e.target.value);
                          // Typed by hand: no map node backs it any more, so
                          // the map cannot route to it and must not pretend to.
                          setTargetNodeId(null);
                        }}
                      />
                    </Field>

                    <div className="lg:hidden">
                      <FitPanel profile={draftProfile} targetId={scoredAgainst} />
                    </div>
                  </div>
                )}

                {/* ── 2. Where they are starting from ──────────── */}
                {step === 1 && (
                  <div className="grid gap-6">
                    <Field htmlFor="name" label={t(m.onboarding.name)}>
                      <Input
                        id="name"
                        className={fieldClass}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </Field>
                    <Field htmlFor="school" label={t(m.onboarding.school)}>
                      <Input
                        id="school"
                        className={fieldClass}
                        value={school}
                        onChange={(e) => setSchool(e.target.value)}
                      />
                    </Field>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <Field htmlFor="major" label={t(m.onboarding.major)}>
                        <Input
                          id="major"
                          className={fieldClass}
                          value={major}
                          onChange={(e) => setMajor(e.target.value)}
                        />
                      </Field>
                      <Field htmlFor="year" label={t(m.onboarding.year)}>
                        <Select value={year} onValueChange={setYear}>
                          <SelectTrigger id="year" className={cn(fieldClass, "w-full")}>
                            <SelectValue placeholder={t(m.onboarding.yearPlaceholder)} />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              m.onboarding.year1,
                              m.onboarding.year2,
                              m.onboarding.year3,
                              m.onboarding.year4,
                              m.onboarding.graduated,
                            ].map((entry) => (
                              <SelectItem key={t(entry)} value={t(entry)}>
                                {t(entry)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>

                    <div className="lg:hidden">
                      <FitPanel profile={draftProfile} targetId={scoredAgainst} />
                    </div>
                  </div>
                )}

                {/* ── 3. What they have already ────────────────── */}
                {step === 2 && (
                  <div className="grid gap-6">
                    <Field htmlFor="courses" label={t(m.onboarding.courses)}>
                      <Textarea
                        id="courses"
                        rows={4}
                        className="text-sm"
                        placeholder={t(m.onboarding.coursesPlaceholder)}
                        value={courses}
                        onChange={(e) => setCourses(e.target.value)}
                      />
                    </Field>

                    <div className="lg:hidden">
                      <FitPanel profile={draftProfile} targetId={scoredAgainst} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="sticky bottom-0 border-t bg-background/85 px-5 py-4 backdrop-blur-sm sm:px-8 lg:px-12 lg:py-5 xl:px-16">
          <div className="mx-auto flex w-full max-w-md items-center gap-3">
            <Button
              variant="outline"
              size="icon-lg"
              aria-label={t(m.onboarding.backStep)}
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0 || finishing}
              className="size-11 shrink-0 rounded-lg sm:size-10 [&_svg]:-translate-x-px"
            >
              <ChevronLeft />
            </Button>
            <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
              {t(m.onboarding.stepOf(step + 1, TOTAL_STEPS))}
            </span>
            {step < steps.length - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                // The one gate in the flow, and only on the first screen: every
                // question after it is scored against this answer, so carrying
                // on without one would show a fit panel with nothing to be a
                // fit for. "Not sure yet" satisfies it, which is the point.
                disabled={step === 0 && !chose}
                className={cn(
                  "ml-auto h-11 flex-1 rounded-lg px-5 sm:h-10 sm:flex-none",
                  pressCta,
                )}
              >
                {t(current.next)}
                <ArrowRight data-icon="inline-end" />
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                disabled={finishing}
                className={cn(
                  "ml-auto h-11 flex-1 rounded-lg px-5 sm:h-10 sm:flex-none",
                  pressCta,
                )}
              >
                {finishing ? (
                  <>
                    <Loader2 data-icon="inline-start" className="animate-spin" />
                    {t(m.onboarding.savingStatus)}
                  </>
                ) : (
                  <>
                    {t(current.next)}
                    <ArrowRight data-icon="inline-end" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </section>

      <Toaster position="top-right" />
    </div>
  );
}

function PreviewList({
  rows,
  empty,
}: {
  rows: { label: string; value: string }[];
  empty: string;
}) {
  return (
    <dl className="grid gap-3">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-0.5">
          <dt className="text-[11px] tracking-wide text-background/50 uppercase">
            {row.label}
          </dt>
          <dd
            className={cn(
              "truncate text-sm",
              row.value.trim() ? "text-background" : "text-background/40",
            )}
          >
            {row.value.trim() || empty}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Field({
  htmlFor,
  label,
  hint,
  children,
}: {
  htmlFor?: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>
        {label}
        {hint ? <span className="font-normal text-muted-foreground">({hint})</span> : null}
      </Label>
      {children}
    </div>
  );
}
