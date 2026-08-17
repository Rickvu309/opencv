import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { meFn } from "@/features/auth/server";
import { AppSidebar } from "@/ui/shell";
import { NotificationBell } from "@/ui/notifications";

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
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex justify-end border-b border-border px-4 py-3">
          <NotificationBell />
        </header>
        <main id="main" className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
