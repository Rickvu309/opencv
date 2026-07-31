"use client";

import { useEffect } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { AskCopilotButton } from "@/components/shared/ask-copilot-button";
import { GapInsightSection } from "@/components/skills/gap-insight-section";
import { LearningPlanSection } from "@/components/skills/learning-plan-section";
import { SkillMapSection } from "@/components/skills/skill-map-section";
import { useCopilotSurface, useStore } from "@/lib/store";
import type { GapInsight } from "@/lib/types";

const SKILL_HIGHLIGHT_DURATION_MS = 2500;

export default function SkillsPage() {
  useCopilotSurface("Skills & Learning");
  const { state, clearSkillHighlight } = useStore();

  const highlightedId = state.highlightedSkillId;

  useEffect(() => {
    if (!highlightedId) return;
    const timeout = setTimeout(() => clearSkillHighlight(highlightedId), SKILL_HIGHLIGHT_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [highlightedId, clearSkillHighlight]);

  const gapInsights = state.insights.filter(
    (insight): insight is GapInsight => insight.kind === "gap" && insight.hostType === "skill"
  );

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Skills & Learning"
        description={`${state.skills.length} tracked skills, ${state.skills.filter((s) => s.isGap).length} flagged as gaps against your target direction.`}
      />

      <div className="flex flex-col gap-8 p-6">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2>Skill map</h2>
            <AskCopilotButton surface="Skills & Learning" objectLabel="Skill map" />
          </div>
          <SkillMapSection
            skills={state.skills}
            trackRecordEntries={state.trackRecordEntries}
            opportunities={state.opportunities}
            highlightedSkillId={highlightedId}
          />
        </section>

        <section>
          <GapInsightSection gapInsights={gapInsights} skills={state.skills} />
        </section>

        <section>
          <LearningPlanSection
            skills={state.skills}
            learningItems={state.learningItems}
            goals={state.goals}
          />
        </section>
      </div>
    </div>
  );
}
