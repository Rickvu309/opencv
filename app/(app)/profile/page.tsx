"use client";

import { DetailPage } from "@/components/shell/detail-page";
import { ProfileIdentityBand } from "@/components/profile/profile-identity-band";
import { ProfileSummaryCard } from "@/components/profile/profile-summary-card";
import { ProfileExperienceCard } from "@/components/profile/profile-experience-card";
import { ProfileStrengthsCard } from "@/components/profile/profile-strengths-card";
import { ProfilePreferencesCard } from "@/components/profile/profile-preferences-card";
import { ProfileCopilotUsesCard } from "@/components/profile/profile-copilot-uses-card";
import { ProfileStrengthCard } from "@/components/profile/profile-strength-card";
import { ProfileUsedByCard } from "@/components/profile/profile-used-by-card";
import { computeProfileStrength } from "@/lib/profile-utils";
import { useCopilotSurface, useStore } from "@/lib/store";

export default function ProfilePage() {
  useCopilotSurface("Profile");
  const { state } = useStore();
  const { profile } = state;

  const { percent, prompts } = computeProfileStrength(profile, state.trackRecordEntries);

  // Opportunities whose fit analysis actually cites this profile: any
  // opportunity Copilot judged fit for and found something to say, as
  // opposed to opp-2, whose credibility check failed before fit could be
  // judged against the profile at all.
  const citingOpportunities = state.opportunities.filter((opportunity) => {
    const fitInsight = state.insights.find(
      (insight) =>
        insight.kind === "fit" && insight.hostType === "opportunity" && insight.hostId === opportunity.id
    );
    return fitInsight && fitInsight.kind === "fit" && fitInsight.strengths.length > 0;
  });

  return (
    <DetailPage
      title="Profile"
      description="Your career context, and how Copilot puts it to work."
      band={<ProfileIdentityBand profile={profile} strengthPercent={percent} />}
      rail={
        <>
          <ProfileCopilotUsesCard />
          <ProfileStrengthCard percent={percent} prompts={prompts} />
          <ProfileUsedByCard opportunities={citingOpportunities} />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ProfileSummaryCard />
        <ProfileExperienceCard />
        <ProfileStrengthsCard />
        <ProfilePreferencesCard />
      </div>
    </DetailPage>
  );
}
