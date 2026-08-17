"use client";

// The front door.
//
// One screen, once, at sign-up. The Coach is the product, so this only
// collects what the first turn needs: a direction (or an honest "not sure"),
// a name, and, if they have one, the CV they already keep. School, courses
// and the rest wait until the Coach asks.
//
// A dropped file lands in My Paper as an upload. OpenPath does not parse PDFs.

import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "@/lib/nav";
import { ArrowRight, Check } from "lucide-react";

import { CoachBox } from "@/components/brand/coach-box";
import { ResumeDrop } from "@/components/onboarding/resume-drop";
import { SkipLink } from "@/components/layout/skip-link";
import { knownDirection } from "@/lib/onboarding/known-direction";
import { needsOnboarding } from "@/lib/onboarding/complete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { flushState } from "@/lib/actions/persistence";
import { useAppState, useDispatch } from "@/lib/actions/store";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const state = useAppState();
  const { profile, uploads } = state;
  const { t, m } = useT();
  const alreadyDone = !needsOnboarding(state);

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

  React.useLayoutEffect(() => {
    if (alreadyDone) router.replace("/coach");
  }, [alreadyDone, router]);

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

    dispatch("onboarding.complete", {}, quiet);
    flushState();

    const question = role
      ? t(m.onboarding.firstQuestionForRole(role))
      : t(m.onboarding.firstQuestionUnsure);
    router.to("/coach", { q: question });
  }

  if (alreadyDone) return null;

  return (
    <div className="flex min-h-svh flex-col">
      <SkipLink />
      <header className="flex items-center px-5 py-5 sm:px-8">
        <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <CoachBox size="sm" />
          OpenPath
        </p>
      </header>

      <main
        id="main-content"
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-12 sm:px-8"
      >
        <h1 className="type-headline text-balance">{t(m.onboarding.goalHeadline)}</h1>
        <p className="mt-2 text-sm text-pretty text-foreground">
          {t(m.onboarding.asideCoachHint)}
        </p>

        <div className="mt-8 overflow-hidden rounded-xl border bg-card">
          <div role="group" aria-labelledby="onboarding-role" className="p-5">
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
                  "relative flex size-4 shrink-0 items-center justify-center rounded-sm border duration-[var(--duration-press)] ease-snap motion-reduce:transition-none",
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
            {unsure ? (
              <p className="mt-3 text-sm text-foreground">
                {t(m.onboarding.unsureNote)}
              </p>
            ) : (
              <form.Subscribe selector={(state) => state.values.targetRole}>
                {(targetRole) =>
                  targetRole.trim().length >= 3 ? (
                    <p className="mt-3 text-sm text-foreground" role="status">
                      {knownDirection(targetRole)
                        ? t(m.onboarding.knownDirection(knownDirection(targetRole)!))
                        : t(m.onboarding.writtenDirection)}
                    </p>
                  ) : null
                }
              </form.Subscribe>
            )}
          </div>

          <div className="border-t border-border p-5">
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

          <div className="border-t border-border p-5">
            <h2 id="onboarding-cv" className="text-sm font-medium">
              {t(m.onboarding.cvYours)}
            </h2>
            <p className="mt-1 text-sm text-foreground">{t(m.onboarding.cvLead)}</p>
            <div className="mt-4">
              <ResumeDrop
                name={resumeName}
                label={t(m.onboarding.cvDrop)}
                onPick={setResumeName}
                onClear={() => setResumeName(null)}
              />
            </div>
          </div>
        </div>

        <Button
          onClick={() => finish(true)}
          disabled={finishing}
          className="mt-6 h-11 w-full"
        >
          {t(m.onboarding.finishNext)}
          <ArrowRight data-icon="inline-end" />
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {t(m.onboarding.privacy)}
        </p>
        {!resumeName && (
          <button
            type="button"
            disabled={finishing}
            onClick={() => finish(false)}
            className="mt-3 text-center text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t(m.onboarding.cvNone)}
          </button>
        )}
      </main>
    </div>
  );
}
