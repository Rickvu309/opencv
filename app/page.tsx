import { LandingPage } from "@/components/marketing/landing-page";

// The public marketing landing (RDS-991). Renders outside DesktopGuard on
// purpose, fully responsive down to mobile, unlike every route under
// (app), (recruiter), and /onboarding. "Open OpenPath" (in the hero and
// the closing section) carries the old root-page redirect logic instead:
// see components/marketing/open-openpath-button.tsx.
export default function RootPage() {
  return <LandingPage />;
}
