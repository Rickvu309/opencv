"use client";

import dynamic from "next/dynamic";

import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { ShowcaseBlock } from "@/components/marketing/showcase-block";

// Each showcase's chunk, and the real product data and components it pulls
// in, splits out of the landing page's main bundle and only fetches once
// its LazyMount placeholder scrolls near the viewport (brief section 3's
// bundle-discipline rule).
const OpportunityWorkspaceShowcase = dynamic(
  () => import("@/components/marketing/showcases/opportunity-workspace-showcase").then((m) => m.OpportunityWorkspaceShowcase),
  { ssr: false }
);
const SignalFlowShowcase = dynamic(
  () => import("@/components/marketing/showcases/signal-flow-showcase").then((m) => m.SignalFlowShowcase),
  { ssr: false }
);
const AchievementMemoryShowcase = dynamic(
  () => import("@/components/marketing/showcases/achievement-memory-showcase").then((m) => m.AchievementMemoryShowcase),
  { ssr: false }
);
const PlannerRoadmapShowcase = dynamic(
  () => import("@/components/marketing/showcases/planner-roadmap-showcase").then((m) => m.PlannerRoadmapShowcase),
  { ssr: false }
);

export function SignatureWorkflowsSection() {
  return (
    <section id="how-it-works-detail" className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 py-24">
      <ScrollReveal className="flex flex-col gap-2 text-center">
        <span className="text-section-label mx-auto">Inside OpenPath</span>
        <h2 className="mx-auto max-w-2xl text-3xl leading-[1.15] font-semibold tracking-tight text-foreground">
          Four workflows, one coherent product.
        </h2>
      </ScrollReveal>

      <ShowcaseBlock
        eyebrow="Opportunity workspace"
        headline="Two lists, not one overwhelming pile."
        copy="Active holds what's actually moving: applied, interviewing, offered. Watchlist holds what's worth watching, without crowding the work in motion."
        address="openpath.app/opportunities"
        contentWidth={900}
        cropHeight={360}
        visual={<OpportunityWorkspaceShowcase />}
      />

      <ShowcaseBlock
        eyebrow="The trust story"
        headline="Every AI claim shows its work."
        copy="Signal, why it matters, the evidence behind it, the proposed change. You approve, edit, or dismiss, and undo stays one click away after you accept."
        address="openpath.app/opportunities/opp-6"
        contentWidth={640}
        cropHeight={340}
        visual={<SignalFlowShowcase />}
        reverse
      />

      <ShowcaseBlock
        eyebrow="Rewind and career memory"
        headline="Nothing you accomplish disappears again."
        copy="Rewind turns a week's real activity into evidence-backed proof. Confirm it once, and it joins your track record for good, ready to reuse anywhere."
        address="openpath.app/rewind"
        contentWidth={760}
        cropHeight={420}
        visual={<AchievementMemoryShowcase />}
      />

      <ShowcaseBlock
        eyebrow="Path planner and roadmap"
        headline="A working path, not just an insight."
        copy="Choose a direction, see the gap, and get a staged plan with the single most important next move pinned at the top, not buried in a report."
        address="openpath.app/roadmap"
        contentWidth={760}
        cropHeight={420}
        visual={<PlannerRoadmapShowcase />}
        reverse
      />
    </section>
  );
}
