"use client";

// The front door.
//
// One screen, once, at sign-up. The Coach is the product, so this only
// collects what the first turn needs: a name, a direction (or an honest
// "not sure") and, if they have one, the CV they already keep. School,
// courses and the rest wait until the Coach asks.
//
// A dropped file lands in My Paper as an upload. OpenPath does not parse PDFs.

import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "@/lib/nav";
import { ArrowRight, Check } from "lucide-react";

import { CoachBox } from "@/components/brand/coach-box";
import { ResumeDrop } from "@/components/onboarding/resume-drop";
import { knownDirection } from "@/lib/onboarding/known-direction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { Toggle } from "@/components/ui/toggle";
import { flushState } from "@/lib/actions/persistence";
import { useAppState, useDispatch } from "@/lib/actions/store";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

const pressCta =
  "active:scale-[0.96] transition-transform duration-[var(--duration-press)] ease-snap motion-reduce:transition-none";

export default function OnboardingPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { profile, uploads } = useAppState();
  const { t, m } = useT();

  const existingCv = uploads.find((item) => item.kind === "cv");

  const [unsure, setUnsure] = React.useState(false);
  const [resumeName, setResumeName] = React.useState<string | null>(
    existingCv?.fileName ?? null,
  );
  const [finishing, setFinishing] = React.useState(false);
  const form = useForm({
    defaultValues: {
      name: profile.identity.name,
      targetRole: profile.identity.targetRole,
    },
  });

  function finish(keepResume: boolean) {
    if (finishing) return;
    setFinishing(true);

    const quiet = { silent: true } as const;
    const identity: { name?: string; targetRole?: string } = {};
    const trimmedName = form.getFieldValue("name").trim();
    if (trimmedName) identity.name = trimmedName;
    const role = unsure ? "" : form.getFieldValue("targetRole").trim();
    if (role) identity.targetRole = role;
    if (Object.keys(identity).length > 0) {
      dispatch("profile.setIdentity", identity, quiet);
    }

    const fileName = keepResume ? resumeName : null;
    const already = uploads.some((item) => item.fileName === fileName);
    if (fileName && !already) {
      dispatch(
        "paper.addUpload",
        {
          kind: "cv",
          label: fileName,
          fileName,
        },
        quiet,
      );
    }

    flushState();

    const question = role
      ? t(m.onboarding.firstQuestionForRole(role))
      : t(m.onboarding.firstQuestionUnsure);
    router.push(`/coach?q=${encodeURIComponent(question)}`);
  }

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <CoachBox size="sm" filled />
          </span>
          OpenPath
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 pb-12">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {t(m.onboarding.beforeCoach)}
        </h1>

        <div className="mt-8 rounded-xl border bg-card p-5">
          <h2 id="onboarding-name" className="text-sm font-medium">
            {t(m.onboarding.name)}
          </h2>
          <form.Field name="name">
            {(field) => (
              <Input
                id="onboarding-name-field"
                name={field.name}
                autoComplete="name"
                aria-labelledby="onboarding-name"
                className="mt-3 h-11 text-base md:text-sm"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>
        </div>

        <div
          role="group"
          aria-labelledby="onboarding-role"
          className="mt-3 rounded-xl border bg-card p-5"
        >
          <h2 id="onboarding-role" className="text-sm font-medium">
            {t(m.onboarding.roleWanted)}
          </h2>
          <form.Field name="targetRole">
            {(field) => (
              <Input
                id="onboarding-role-field"
                name={field.name}
                autoComplete="organization-title"
                aria-labelledby="onboarding-role"
                className="mt-3 h-11 text-base md:text-sm"
                placeholder={t(m.onboarding.targetRolePlaceholder)}
                value={unsure ? "" : field.state.value}
                onChange={(event) => {
                  setUnsure(false);
                  field.handleChange(event.target.value);
                }}
                onFocus={() => {
                  if (unsure) setUnsure(false);
                }}
              />
            )}
          </form.Field>
          <Toggle
            pressed={unsure}
            onPressedChange={(next) => {
              setUnsure(next);
              if (next) form.setFieldValue("targetRole", "");
            }}
            variant="outline"
            className={cn(
              "mt-3 h-11 w-full justify-start gap-2.5 rounded-lg px-3 text-left font-normal whitespace-normal touch-manipulation",
              "hover:bg-muted hover:text-foreground",
              "data-[state=on]:border-foreground data-[state=on]:bg-muted data-[state=on]:font-medium data-[state=on]:text-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "relative flex size-4 shrink-0 items-center justify-center rounded-sm border transition-[border-color,background-color] duration-[var(--duration-press)] ease-snap motion-reduce:transition-none",
                unsure
                  ? "border-foreground bg-foreground"
                  : "border-muted-foreground/60",
              )}
            >
              <Check
                className={cn(
                  "size-3 text-background transition-[opacity,scale,filter] duration-[var(--duration-surface)] ease-snap motion-reduce:transition-none",
                  unsure
                    ? "scale-100 opacity-100 blur-none"
                    : "scale-[0.25] opacity-0 blur-[4px]",
                )}
                strokeWidth={2.5}
              />
            </span>
            {t(m.onboarding.unsureTitle)}
          </Toggle>
          <form.Subscribe selector={(state) => state.values.targetRole}>
            {(targetRole) =>
              !unsure && targetRole.trim().length >= 3 ? (
                <p className="mt-3 text-sm text-muted-foreground" role="status">
                  {knownDirection(targetRole)
                    ? t(m.onboarding.knownDirection(knownDirection(targetRole)!))
                    : t(m.onboarding.writtenDirection)}
                </p>
              ) : null
            }
          </form.Subscribe>
        </div>

        <div className="mt-3 rounded-xl border bg-card p-5">
          <h2 id="onboarding-cv" className="text-sm font-medium">
            {t(m.onboarding.cvYours)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(m.onboarding.cvLead)}
          </p>
          <div className="mt-4">
            <ResumeDrop
              name={resumeName}
              label={t(m.onboarding.cvDrop)}
              onPick={setResumeName}
              onClear={() => setResumeName(null)}
            />
          </div>
        </div>

        <Button
          onClick={() => finish(true)}
          disabled={finishing}
          className={cn("mt-6 h-11 w-full rounded-lg", pressCta)}
        >
          {t(m.onboarding.finishNext)}
          <ArrowRight data-icon="inline-end" />
        </Button>
        <button
          type="button"
          disabled={finishing}
          onClick={() => finish(false)}
          className="mt-3 text-center text-sm text-muted-foreground"
        >
          {t(m.onboarding.cvNone)}
        </button>
      </main>

      <Toaster position="top-center" />
    </div>
  );
}
