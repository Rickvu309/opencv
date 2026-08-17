import { createFileRoute } from "@tanstack/react-router";

import OnboardingPage from "./-page";

export const Route = createFileRoute("/onboarding/")({
  component: OnboardingPage,
});
