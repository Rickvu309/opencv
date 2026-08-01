import type { ReactNode } from "react";

import { DesktopGuard } from "@/components/shell/desktop-guard";

// Onboarding stays inside the desktop guard: it is the first step of the
// desktop-only app experience, not the public landing surface. Only the
// marketing landing at "/" (app/page.tsx) renders outside the guard.
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <DesktopGuard>{children}</DesktopGuard>;
}
