import { createFileRoute, redirect } from "@tanstack/react-router";
import { OnboardingScreen } from "@/features/onboarding/screens/onboarding";
import { meFn } from "@/features/auth/server";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: async () => {
    const user = await meFn();
    if (!user) throw redirect({ to: "/sign-in" });
    if (user.onboardingCompletedAt) throw redirect({ to: "/proof" });
  },
  component: OnboardingScreen,
});
