"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { WelcomeStep } from "@/components/onboarding/steps/welcome-step";
import { AboutStep } from "@/components/onboarding/steps/about-step";
import { DirectionStep } from "@/components/onboarding/steps/direction-step";
import { GoalsStep } from "@/components/onboarding/steps/goals-step";
import { CopilotStep } from "@/components/onboarding/steps/copilot-step";
import { ReadyStep } from "@/components/onboarding/steps/ready-step";
import {
  SUGGESTED_GOALS,
  buildExampleOnboardingData,
  buildPreferencesLocation,
  createEmptyOnboardingData,
} from "@/components/onboarding/onboarding-data";
import type { OnboardingData } from "@/components/onboarding/onboarding-data";
import { useStore } from "@/lib/store";
import type { OnboardingProfilePatch } from "@/lib/store";

const STEP_COUNT = 6;
const COPILOT_STEP_INDEX = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const { markOnboarded, completeOnboarding } = useStore();

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [data, setData] = useState(createEmptyOnboardingData);
  const [copilotReady, setCopilotReady] = useState(false);

  function updateData(patch: Partial<OnboardingData>) {
    setData((current) => ({ ...current, ...patch }));
  }

  const goTo = useCallback(
    (nextIndex: number) => {
      setDirection(nextIndex > stepIndex ? 1 : -1);
      if (nextIndex === COPILOT_STEP_INDEX) setCopilotReady(false);
      setStepIndex(nextIndex);
    },
    [stepIndex]
  );

  function skip() {
    markOnboarded();
    router.push("/home");
  }

  function finish() {
    const finalGoals = [
      ...SUGGESTED_GOALS.filter((goal) => data.selectedGoalIds.includes(goal.id)),
      ...data.customGoals,
    ];
    const workStyle = data.workStyle || "Remote";
    const profilePatch: OnboardingProfilePatch = {
      currentRole: data.currentRole.trim(),
      experienceLevel: data.experienceLevel,
      location: data.location.trim(),
      strengths: data.strengths,
      targetDirectionLabel: data.targetDirectionLabel.trim(),
      nearTermPriority: data.nearTermPriority,
      preferences: {
        remote: workStyle === "Remote",
        workStyle,
        companySize: data.companySize,
        location: buildPreferencesLocation(data.location.trim(), workStyle),
      },
    };
    completeOnboarding(profilePatch, finalGoals);
    router.push("/home");
  }

  const totalGoals = data.selectedGoalIds.length + data.customGoals.length;

  const canAdvance =
    stepIndex === 0 ||
    (stepIndex === 1 && data.currentRole.trim() !== "" && data.experienceLevel !== "" && data.location.trim() !== "") ||
    (stepIndex === 2 &&
      data.targetDirectionLabel.trim() !== "" &&
      data.workStyle !== "" &&
      data.companySize !== "" &&
      data.nearTermPriority !== "") ||
    (stepIndex === 3 && totalGoals >= 2 && totalGoals <= 4) ||
    (stepIndex === 4 && copilotReady) ||
    stepIndex === STEP_COUNT - 1;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (isTyping) return;

      if (event.key === "ArrowRight" && canAdvance && stepIndex < STEP_COUNT - 1) {
        goTo(stepIndex + 1);
      } else if (event.key === "ArrowLeft" && stepIndex > 0) {
        goTo(stepIndex - 1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canAdvance, stepIndex, goTo]);

  return (
    <OnboardingShell
      stepIndex={stepIndex}
      stepCount={STEP_COUNT}
      direction={direction}
      onBack={stepIndex > 0 ? () => goTo(stepIndex - 1) : undefined}
      onSkip={stepIndex < STEP_COUNT - 1 ? skip : undefined}
      primaryLabel={
        stepIndex === 0
          ? "Set up my workspace"
          : stepIndex === STEP_COUNT - 1
            ? "Open my workspace"
            : "Next"
      }
      primaryIcon={stepIndex === 0 || stepIndex === STEP_COUNT - 1 ? <Sparkles className="size-4" /> : undefined}
      onPrimary={() => (stepIndex === STEP_COUNT - 1 ? finish() : goTo(stepIndex + 1))}
      primaryDisabled={!canAdvance}
    >
      {stepIndex === 0 ? <WelcomeStep /> : null}
      {stepIndex === 1 ? (
        <AboutStep data={data} onChange={updateData} onUseExample={() => setData(buildExampleOnboardingData())} />
      ) : null}
      {stepIndex === 2 ? <DirectionStep data={data} onChange={updateData} /> : null}
      {stepIndex === 3 ? <GoalsStep data={data} onChange={updateData} /> : null}
      {stepIndex === 4 ? <CopilotStep data={data} onReady={() => setCopilotReady(true)} /> : null}
      {stepIndex === 5 ? <ReadyStep data={data} /> : null}
    </OnboardingShell>
  );
}
