import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { signedInHomeFn } from "@/features/auth/server";
import { completeOnboardingFn } from "@/features/onboarding/queries";
import {
  OnboardingWizard,
  type OnboardingValues,
} from "@/features/onboarding/components/onboarding-wizard";

const empty: OnboardingValues = {
  step: 0,
  targetRole: "",
  unsure: false,
  school: "",
  major: "",
  year: "",
  org: "",
  role: "",
  linkKind: "",
  linkUrl: "",
  pending: false,
  saveError: null,
};

export function OnboardingScreen() {
  const navigate = useNavigate();
  const [values, setValues] = useState<OnboardingValues>(empty);

  function patch(next: Partial<OnboardingValues>) {
    setValues((prev) => ({ ...prev, ...next }));
  }

  async function finish() {
    if (values.pending) return;
    patch({ pending: true, saveError: null });
    try {
      await completeOnboardingFn({
        data: {
          targetRole: values.unsure ? null : values.targetRole || null,
          school: values.school,
          major: values.major,
          year: values.year,
          org: values.org,
          role: values.role,
          linkKind: values.linkKind || (values.linkUrl ? "portfolio" : undefined),
          linkUrl: values.linkUrl,
        },
      });
    } catch {
      patch({ pending: false, saveError: "Couldn't save. Try again." });
      return;
    }
    try {
      await navigate(await signedInHomeFn());
    } catch {
      await navigate({ to: "/proof" });
    }
  }

  return (
    <OnboardingWizard
      values={values}
      onChange={patch}
      onContinue={() => patch({ step: values.step + 1 })}
      onSkip={() => void finish()}
      onFinish={() => void finish()}
    />
  );
}
