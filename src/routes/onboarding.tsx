import { createFileRoute, redirect } from "@tanstack/react-router";
import { OnboardingScreen } from "@/features/onboarding/screens/onboarding";
import { meFn, signedInHomeFn } from "@/features/auth/server";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: async () => {
    const user = await meFn();
    if (!user) throw redirect({ to: "/sign-in" });
    if (user.onboardingCompletedAt) throw redirect(await signedInHomeFn());
  },
  component: OnboardingScreen,
});
