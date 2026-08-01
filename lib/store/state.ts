// The store's shape and its seed-backed initial value. Split out of
// lib/store.tsx (RDS-981 hygiene pass) so the state shape, the reducer
// domains, and the provider's action creators can each live in their own
// file while `@/lib/store` keeps re-exporting the same public API.

import { persona } from "@/lib/data/persona";
import { opportunities as seedOpportunities } from "@/lib/data/opportunities";
import { activityMoments as seedActivityMoments } from "@/lib/data/activity";
import { cvVersions as seedCvVersions } from "@/lib/data/cvs";
import { trackRecordEntries as seedTrackRecordEntries } from "@/lib/data/track-record";
import {
  goals as seedGoals,
  pathScenarios as seedPathScenarios,
  directionGapAnalysis as seedDirectionGapAnalysis,
} from "@/lib/data/goals";
import { skills as seedSkills, learningItems as seedLearningItems } from "@/lib/data/skills";
import { planItems as seedPlanItems, plannerGapAnalyses as seedPlannerGapAnalyses } from "@/lib/data/planner";
import { roadmapResources as seedRoadmapResources } from "@/lib/data/roadmap";
import { insights as seedInsights } from "@/lib/data/insights";
import { proofTransformations as seedProofTransformations } from "@/lib/data/proof";
import { comparisonProfiles as seedComparisonProfiles } from "@/lib/data/comparison";
import { nextActions as seedNextActions } from "@/lib/data/actions";
import { nudges as seedNudges } from "@/lib/data/nudges";
import {
  rewindCandidates as seedRewindCandidates,
  rewindCarryForwards as seedRewindCarryForwards,
} from "@/lib/data/rewind";
import { aiSignals as seedAiSignals } from "@/lib/data/ai-signals";
import { connectedSources as seedConnectedSources } from "@/lib/data/sources";
import type {
  ActivityMoment,
  AiInsight,
  AiSignal,
  ConnectedSource,
  CopilotMessage,
  CvVersion,
  DirectionGapAnalysis,
  Goal,
  InboxItemLink,
  LearningItem,
  NextAction,
  Nudge,
  Opportunity,
  OpportunityComparisonProfile,
  PathScenario,
  PlanItem,
  PlannerGapAnalysis,
  Profile,
  ProfilePreferences,
  ProofTransformation,
  RewindCandidate,
  RewindCarryForward,
  RoadmapResource,
  Skill,
  TrackRecordEntry,
} from "@/lib/types";

export type OpportunitiesView = "board" | "list";

export type OnboardingProfilePatch = Partial<Omit<Profile, "preferences">> & {
  preferences?: Partial<ProfilePreferences>;
};

// The fields the entry editor can change when a candidate is reviewed and
// confirmed: the user can edit every drafted field before it joins the
// timeline, but the candidate-only fields (whySuggested, evidenceHint) and
// the record's id and status are not user-editable here.
export type TrackRecordConfirmPatch = Pick<
  TrackRecordEntry,
  "title" | "story" | "impact" | "date" | "evidenceTag" | "skillIds"
>;

export interface CopilotState {
  open: boolean;
  surface: string;
  objectLabel?: string;
  thinking: boolean;
  messagesBySurface: Record<string, CopilotMessage[]>;
}

export interface StoreState {
  profile: Profile;
  opportunities: Opportunity[];
  comparisonProfiles: OpportunityComparisonProfile[];
  comparisonSelection: string[];
  comparisonModeActive: boolean;
  activityMoments: ActivityMoment[];
  cvVersions: CvVersion[];
  trackRecordEntries: TrackRecordEntry[];
  goals: Goal[];
  pathScenarios: PathScenario[];
  directionGapAnalysis: DirectionGapAnalysis;
  skills: Skill[];
  learningItems: LearningItem[];
  workingPathScenarioId: string;
  planItems: PlanItem[];
  plannerGapAnalyses: PlannerGapAnalysis[];
  roadmapResources: RoadmapResource[];
  insights: AiInsight[];
  proofTransformations: ProofTransformation[];
  nextActions: NextAction[];
  nudges: Nudge[];
  aiSignals: AiSignal[];
  connectedSources: ConnectedSource[];
  inboxItemLinks: Record<string, InboxItemLink>;
  rewindCandidates: RewindCandidate[];
  rewindCarryForwards: RewindCarryForward[];
  rewindViewedThisSession: boolean;
  /** Strategy (RDS-986): decision state for the weekly focus plan's moves, keyed by the move's stable slot id. Absent means "suggested". */
  strategyMoveStates: Record<string, "approved" | "dismissed">;
  onboarded: boolean;
  copilot: CopilotState;
  highlightedOpportunityId?: string;
  highlightedGoalId?: string;
  highlightedSkillId?: string;
  highlightedTrackRecordEntryId?: string;
  opportunitiesView: OpportunitiesView;
  sidebarOpen: boolean;
}

export const initialState: StoreState = {
  profile: persona,
  opportunities: seedOpportunities,
  comparisonProfiles: seedComparisonProfiles,
  comparisonSelection: [],
  comparisonModeActive: false,
  activityMoments: seedActivityMoments,
  cvVersions: seedCvVersions,
  trackRecordEntries: seedTrackRecordEntries,
  goals: seedGoals,
  pathScenarios: seedPathScenarios,
  directionGapAnalysis: seedDirectionGapAnalysis,
  skills: seedSkills,
  learningItems: seedLearningItems,
  workingPathScenarioId:
    seedPathScenarios.find((scenario) => scenario.isClosestToCurrentTrajectory)?.id ?? seedPathScenarios[0].id,
  planItems: seedPlanItems,
  plannerGapAnalyses: seedPlannerGapAnalyses,
  roadmapResources: seedRoadmapResources,
  insights: seedInsights,
  proofTransformations: seedProofTransformations,
  nextActions: seedNextActions,
  nudges: seedNudges,
  aiSignals: seedAiSignals,
  connectedSources: seedConnectedSources,
  inboxItemLinks: {},
  rewindCandidates: seedRewindCandidates,
  rewindCarryForwards: seedRewindCarryForwards,
  rewindViewedThisSession: false,
  strategyMoveStates: {},
  onboarded: false,
  copilot: {
    open: false,
    surface: "Home",
    thinking: false,
    messagesBySurface: {},
  },
  highlightedOpportunityId: undefined,
  highlightedGoalId: undefined,
  highlightedSkillId: undefined,
  highlightedTrackRecordEntryId: undefined,
  opportunitiesView: "board",
  sidebarOpen: true,
};
