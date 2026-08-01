"use client";

import { AiDifferenceSection } from "@/components/marketing/ai-difference-section";
import { ClosingSection } from "@/components/marketing/closing-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { ProblemThesisSection } from "@/components/marketing/problem-thesis-section";
import { RecruiterSection } from "@/components/marketing/recruiter-section";
import { SignatureWorkflowsSection } from "@/components/marketing/signature-workflows-section";
import { StickyCta } from "@/components/marketing/sticky-cta";

/**
 * The public marketing landing at "/" (RDS-991): one guided narrative, the
 * page architecture mirroring the product architecture docs/architecture.md
 * lays out. Fully responsive down to 390px, unlike the app routes below it,
 * which is why it renders outside DesktopGuard (see app/page.tsx and the
 * (app)/(recruiter)/onboarding layouts that carry the guard instead).
 */
export function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <StickyCta />
      <main className="flex flex-1 flex-col divide-y divide-border/60">
        <HeroSection />
        <ProblemThesisSection />
        <HowItWorksSection />
        <SignatureWorkflowsSection />
        <AiDifferenceSection />
        <RecruiterSection />
        <ClosingSection />
      </main>
      <MarketingFooter />
    </div>
  );
}
