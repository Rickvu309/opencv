import { createFileRoute, redirect } from "@tanstack/react-router";
import { meFn } from "@/features/auth/server";
import { AppShell } from "@/features/coach/components/app-shell";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const user = await meFn();
    if (!user) throw redirect({ to: "/sign-in" });
    if (!user.onboardingCompletedAt && location.pathname !== "/onboarding") {
      throw redirect({ to: "/onboarding" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return <AppShell />;
}
