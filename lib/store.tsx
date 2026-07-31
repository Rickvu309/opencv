"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { persona } from "@/lib/data/persona";
import { opportunities as seedOpportunities } from "@/lib/data/opportunities";
import { activityMoments as seedActivityMoments } from "@/lib/data/activity";
import { cvVersions as seedCvVersions } from "@/lib/data/cvs";
import {
  buildPanelPrepCandidate,
  PANEL_PREP_TRIGGER_ACTION_ID,
  PANEL_PREP_CANDIDATE_ID,
  trackRecordEntries as seedTrackRecordEntries,
} from "@/lib/data/track-record";
import {
  goals as seedGoals,
  pathScenarios as seedPathScenarios,
  directionGapAnalysis as seedDirectionGapAnalysis,
} from "@/lib/data/goals";
import { skills as seedSkills, learningItems as seedLearningItems } from "@/lib/data/skills";
import { planItems as seedPlanItems, plannerGapAnalyses as seedPlannerGapAnalyses } from "@/lib/data/planner";
import { insights as seedInsights } from "@/lib/data/insights";
import { nextActions as seedNextActions } from "@/lib/data/actions";
import { nudges as seedNudges, weeklyReviewScript } from "@/lib/data/nudges";
import { copilotScripts } from "@/lib/data/copilot-scripts";
import { aiSignals as seedAiSignals } from "@/lib/data/ai-signals";
import { connectedSources as seedConnectedSources } from "@/lib/data/sources";
import { buildPinnedNudgeFromSuggestion, pinnedNudgeId } from "@/lib/nudge-utils";
import { buildSignalActivityMessage } from "@/lib/ai-signal-utils";
import { buildInboxTrackRecordCandidate, evidenceTitle } from "@/lib/inbox-utils";
import type {
  ActivityMoment,
  AiInsight,
  AiSignal,
  ConnectedSource,
  CopilotMessage,
  CopilotResponse,
  CvVersion,
  DirectionGapAnalysis,
  ExperienceEntry,
  Goal,
  GoalProgressNote,
  GoalStatus,
  InboxItemLink,
  InboxLinkChoice,
  LearningItem,
  NextAction,
  NextActionState,
  Nudge,
  Opportunity,
  OpportunityStatus,
  PathScenario,
  PlanItem,
  PlanItemState,
  PlannerGapAnalysis,
  Priority,
  Profile,
  ProfilePreferences,
  Skill,
  SourceEvidence,
  TrackRecordEntry,
  WeeklyReviewScript,
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

interface CopilotState {
  open: boolean;
  surface: string;
  objectLabel?: string;
  thinking: boolean;
  messagesBySurface: Record<string, CopilotMessage[]>;
}

export interface StoreState {
  profile: Profile;
  opportunities: Opportunity[];
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
  insights: AiInsight[];
  nextActions: NextAction[];
  nudges: Nudge[];
  aiSignals: AiSignal[];
  connectedSources: ConnectedSource[];
  inboxItemLinks: Record<string, InboxItemLink>;
  weeklyReview: WeeklyReviewScript;
  weeklyReviewOpen: boolean;
  weeklyReviewViewedThisSession: boolean;
  onboarded: boolean;
  copilot: CopilotState;
  highlightedOpportunityId?: string;
  highlightedGoalId?: string;
  highlightedSkillId?: string;
  highlightedTrackRecordEntryId?: string;
  opportunitiesView: OpportunitiesView;
  sidebarOpen: boolean;
}

const initialState: StoreState = {
  profile: persona,
  opportunities: seedOpportunities,
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
  insights: seedInsights,
  nextActions: seedNextActions,
  nudges: seedNudges,
  aiSignals: seedAiSignals,
  connectedSources: seedConnectedSources,
  inboxItemLinks: {},
  weeklyReview: weeklyReviewScript,
  weeklyReviewOpen: false,
  weeklyReviewViewedThisSession: false,
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

type Action =
  | { type: "MARK_ONBOARDED" }
  | { type: "RESET_ONBOARDING" }
  | { type: "COMPLETE_ONBOARDING"; profilePatch: OnboardingProfilePatch; goals: Goal[] }
  | { type: "SET_OPPORTUNITY_STATUS"; id: string; status: OpportunityStatus }
  | { type: "SET_OPPORTUNITY_PRIORITY"; id: string; priority: Priority }
  | { type: "TOGGLE_OPPORTUNITY_DREAM"; id: string }
  | { type: "SET_OPPORTUNITY_NOTES"; id: string; notes: string }
  | { type: "SET_OPPORTUNITIES_VIEW"; view: OpportunitiesView }
  | {
      type: "ADD_OPPORTUNITY";
      opportunity: Opportunity;
      insights?: AiInsight[];
      nextAction?: NextAction;
      activityMoments?: ActivityMoment[];
    }
  | { type: "CLEAR_OPPORTUNITY_HIGHLIGHT"; id: string }
  | { type: "ADD_GOAL"; goal: Goal }
  | {
      type: "EDIT_GOAL";
      id: string;
      patch: Partial<Pick<Goal, "title" | "why" | "targetDate" | "horizon">>;
    }
  | { type: "SET_GOAL_STATUS"; id: string; status: GoalStatus }
  | { type: "ADD_GOAL_PROGRESS_NOTE"; id: string; note: GoalProgressNote }
  | { type: "SET_GOAL_HIGHLIGHT"; id: string }
  | { type: "CLEAR_GOAL_HIGHLIGHT"; id: string }
  | {
      type: "UPDATE_TARGET_DIRECTION";
      patch: Partial<Pick<Profile, "targetDirection" | "targetDirectionLabel" | "targetDirectionHorizon">>;
    }
  | { type: "SET_NEXT_ACTION_STATE"; id: string; state: NextActionState }
  | {
      type: "EDIT_NEXT_ACTION";
      id: string;
      patch: Partial<Pick<NextAction, "verb" | "rationale" | "effort" | "dueHint">>;
    }
  | { type: "ACCEPT_ALTERNATIVE"; id: string; alternativeId: string }
  | { type: "REMOVE_NEXT_ACTION"; id: string }
  | {
      type: "CONFIRM_TRACK_RECORD_CANDIDATE";
      id: string;
      patch: TrackRecordConfirmPatch;
    }
  | { type: "REMOVE_TRACK_RECORD_ENTRY"; id: string }
  | { type: "ADD_TRACK_RECORD_ENTRY"; entry: TrackRecordEntry }
  | { type: "SET_NUDGE_STATE"; id: string; state: Nudge["state"] }
  | { type: "APPROVE_AI_SIGNAL"; id: string; editedValue?: string }
  | { type: "UNDO_AI_SIGNAL"; id: string }
  | { type: "DISMISS_AI_SIGNAL"; id: string }
  | { type: "UNDISMISS_AI_SIGNAL"; id: string }
  | { type: "CONNECT_SOURCE"; id: string }
  | { type: "LINK_INBOX_ITEM"; evidence: SourceEvidence; target: InboxLinkChoice }
  | { type: "UNDO_LINK_INBOX_ITEM"; evidenceId: string }
  | { type: "DISMISS_INBOX_ITEM"; evidenceId: string }
  | { type: "UNDO_DISMISS_INBOX_ITEM"; evidenceId: string }
  | {
      type: "SET_TAILORING_SUGGESTION_STATE";
      insightId: string;
      suggestionId: string;
      state: "accepted" | "dismissed";
    }
  | { type: "ADD_CV_VERSION"; cv: CvVersion }
  | { type: "DELETE_CV_VERSION"; id: string }
  | { type: "SET_CV_SECTION_CONTENT"; cvId: string; sectionId: string; content: string }
  | { type: "SET_CV_OPPORTUNITY_LINK"; cvId: string; opportunityId?: string }
  | {
      type: "CREATE_TAILORED_CV_VERSION";
      cv: CvVersion;
      opportunityId: string;
      activityMoment: ActivityMoment;
    }
  | { type: "SET_LEARNING_ITEM_STATE"; id: string; state: LearningItem["state"] }
  | { type: "SET_WORKING_PATH_SCENARIO"; scenarioId: string }
  | { type: "SET_PLAN_ITEM_STATE"; id: string; state: PlanItemState }
  | { type: "TOGGLE_SKILL_FOCUS"; id: string }
  | { type: "SET_SKILL_HIGHLIGHT"; id: string }
  | { type: "CLEAR_SKILL_HIGHLIGHT"; id: string }
  | { type: "SET_TRACK_RECORD_HIGHLIGHT"; id: string }
  | { type: "CLEAR_TRACK_RECORD_HIGHLIGHT"; id: string }
  | {
      type: "SET_WEEKLY_REVIEW_SUGGESTION_STATE";
      id: string;
      state: "accepted" | "dismissed";
    }
  | { type: "SET_WEEKLY_REVIEW_OPEN"; open: boolean }
  | { type: "MARK_WEEKLY_REVIEW_VIEWED" }
  | { type: "SET_PROFILE_SUMMARY"; summary: string }
  | { type: "SET_PROFILE_EXPERIENCE_ENTRY"; id: string; patch: Partial<Omit<ExperienceEntry, "id">> }
  | { type: "ADD_PROFILE_EXPERIENCE_ENTRY"; entry: ExperienceEntry }
  | { type: "SET_PROFILE_STRENGTHS"; strengths: string[] }
  | { type: "SET_PROFILE_PREFERENCES"; patch: Partial<ProfilePreferences> }
  | { type: "SET_COPILOT_OPEN"; open: boolean }
  | { type: "TOGGLE_COPILOT" }
  | { type: "SET_SIDEBAR_OPEN"; open: boolean }
  | { type: "SET_COPILOT_SURFACE"; surface: string; objectLabel?: string }
  | { type: "ADD_COPILOT_MESSAGE"; surface: string; message: CopilotMessage }
  | { type: "SET_COPILOT_THINKING"; thinking: boolean };

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "MARK_ONBOARDED":
      return { ...state, onboarded: true };

    case "RESET_ONBOARDING":
      return { ...state, onboarded: false };

    case "COMPLETE_ONBOARDING": {
      const { preferences: preferencesPatch, ...profilePatch } = action.profilePatch;
      return {
        ...state,
        profile: {
          ...state.profile,
          ...profilePatch,
          preferences: { ...state.profile.preferences, ...preferencesPatch },
        },
        goals: action.goals,
        onboarded: true,
      };
    }

    case "SET_OPPORTUNITY_STATUS": {
      const dateStamp = today();
      return {
        ...state,
        opportunities: state.opportunities.map((opportunity) =>
          opportunity.id === action.id
            ? { ...opportunity, status: action.status, lastActivityAt: dateStamp }
            : opportunity
        ),
        activityMoments: [
          ...state.activityMoments,
          {
            id: makeId("activity"),
            opportunityId: action.id,
            kind: "status-change",
            message: `Status changed to ${action.status}.`,
            createdAt: dateStamp,
          },
        ],
      };
    }

    case "SET_OPPORTUNITY_PRIORITY":
      return {
        ...state,
        opportunities: state.opportunities.map((opportunity) =>
          opportunity.id === action.id
            ? { ...opportunity, priority: action.priority }
            : opportunity
        ),
      };

    case "TOGGLE_OPPORTUNITY_DREAM":
      return {
        ...state,
        opportunities: state.opportunities.map((opportunity) =>
          opportunity.id === action.id
            ? { ...opportunity, isDream: !opportunity.isDream }
            : opportunity
        ),
      };

    case "SET_OPPORTUNITY_NOTES": {
      const dateStamp = today();
      return {
        ...state,
        opportunities: state.opportunities.map((opportunity) =>
          opportunity.id === action.id
            ? { ...opportunity, notes: action.notes, lastActivityAt: dateStamp }
            : opportunity
        ),
        activityMoments: [
          ...state.activityMoments,
          {
            id: makeId("activity"),
            opportunityId: action.id,
            kind: "note-added",
            message: "Added a note to this opportunity.",
            createdAt: dateStamp,
          },
        ],
      };
    }

    case "SET_OPPORTUNITIES_VIEW":
      return { ...state, opportunitiesView: action.view };

    case "ADD_OPPORTUNITY":
      return {
        ...state,
        opportunities: [action.opportunity, ...state.opportunities],
        insights: action.insights ? [...state.insights, ...action.insights] : state.insights,
        nextActions: action.nextAction
          ? [...state.nextActions, action.nextAction]
          : state.nextActions,
        activityMoments: action.activityMoments
          ? [...state.activityMoments, ...action.activityMoments]
          : state.activityMoments,
        highlightedOpportunityId: action.opportunity.id,
      };

    case "CLEAR_OPPORTUNITY_HIGHLIGHT":
      return state.highlightedOpportunityId === action.id
        ? { ...state, highlightedOpportunityId: undefined }
        : state;

    case "ADD_GOAL":
      return { ...state, goals: [action.goal, ...state.goals] };

    case "EDIT_GOAL":
      return {
        ...state,
        goals: state.goals.map((goal) =>
          goal.id === action.id ? { ...goal, ...action.patch } : goal
        ),
      };

    case "SET_GOAL_STATUS":
      return {
        ...state,
        goals: state.goals.map((goal) =>
          goal.id === action.id ? { ...goal, status: action.status } : goal
        ),
      };

    case "ADD_GOAL_PROGRESS_NOTE":
      return {
        ...state,
        goals: state.goals.map((goal) =>
          goal.id === action.id
            ? { ...goal, progressNotes: [...goal.progressNotes, action.note] }
            : goal
        ),
      };

    case "SET_GOAL_HIGHLIGHT":
      return { ...state, highlightedGoalId: action.id };

    case "CLEAR_GOAL_HIGHLIGHT":
      return state.highlightedGoalId === action.id
        ? { ...state, highlightedGoalId: undefined }
        : state;

    case "UPDATE_TARGET_DIRECTION":
      return { ...state, profile: { ...state.profile, ...action.patch } };

    case "SET_NEXT_ACTION_STATE": {
      const target = state.nextActions.find((nextAction) => nextAction.id === action.id);
      const becameAccepted = action.state === "accepted" && target?.state !== "accepted";
      const becameDone = action.state === "done" && target?.state !== "done";
      const dateStamp = today();

      const updatedActions = state.nextActions.map((nextAction) =>
        nextAction.id === action.id ? { ...nextAction, state: action.state } : nextAction
      );

      const followUpAction: NextAction | null =
        becameDone && target?.followUp
          ? {
              id: makeId("action"),
              opportunityId: target.opportunityId,
              verb: target.followUp.verb,
              rationale: target.followUp.rationale,
              effort: target.followUp.effort,
              dueHint: target.followUp.dueHint,
              state: "suggested",
              confidence: target.followUp.confidence,
            }
          : null;

      const newActivityMoments: ActivityMoment[] = [];
      if (becameAccepted && target) {
        newActivityMoments.push({
          id: makeId("activity"),
          opportunityId: target.opportunityId,
          kind: "action-accepted",
          message: `Accepted the next action: ${target.verb}`,
          createdAt: dateStamp,
        });
      }
      if (becameDone && target) {
        newActivityMoments.push({
          id: makeId("activity"),
          opportunityId: target.opportunityId,
          kind: "action-done",
          message: `Marked done: ${target.verb}`,
          createdAt: dateStamp,
        });
      }
      if (followUpAction) {
        newActivityMoments.push({
          id: makeId("activity"),
          opportunityId: followUpAction.opportunityId,
          kind: "copilot-analysis",
          message: `Copilot suggested a follow-up: ${followUpAction.verb}`,
          createdAt: dateStamp,
        });
      }

      // The one scripted example of flow 9's capture prompt: marking done
      // the Meridian Labs panel-prep action while that opportunity sits at
      // Interview seeds a fresh Track Record candidate into the review
      // inbox. Guarded by opportunity status (not just the action id) and
      // by checking the candidate isn't already seeded, so replaying the
      // done transition never duplicates it.
      const targetOpportunity = target
        ? state.opportunities.find((opportunity) => opportunity.id === target.opportunityId)
        : undefined;
      const shouldSeedCandidate =
        becameDone &&
        action.id === PANEL_PREP_TRIGGER_ACTION_ID &&
        targetOpportunity?.status === "Interview" &&
        !state.trackRecordEntries.some((entry) => entry.id === PANEL_PREP_CANDIDATE_ID);
      const seededCandidate = shouldSeedCandidate ? buildPanelPrepCandidate(dateStamp) : null;

      return {
        ...state,
        nextActions: followUpAction ? [...updatedActions, followUpAction] : updatedActions,
        activityMoments:
          newActivityMoments.length > 0
            ? [...state.activityMoments, ...newActivityMoments]
            : state.activityMoments,
        trackRecordEntries: seededCandidate
          ? [...state.trackRecordEntries, seededCandidate]
          : state.trackRecordEntries,
      };
    }

    case "EDIT_NEXT_ACTION":
      return {
        ...state,
        nextActions: state.nextActions.map((nextAction) =>
          nextAction.id === action.id ? { ...nextAction, ...action.patch } : nextAction
        ),
      };

    case "ACCEPT_ALTERNATIVE": {
      const target = state.nextActions.find((nextAction) => nextAction.id === action.id);
      const alternative = target?.alternatives?.find((entry) => entry.id === action.alternativeId);
      if (!target || !alternative) return state;
      const dateStamp = today();

      return {
        ...state,
        nextActions: state.nextActions.map((nextAction) =>
          nextAction.id === action.id
            ? {
                ...nextAction,
                verb: alternative.verb,
                rationale: alternative.rationale,
                effort: alternative.effort,
                dueHint: alternative.dueHint,
                confidence: alternative.confidence,
                state: "accepted",
                followUp: alternative.followUp,
                handoff: alternative.handoff,
                copilotPrompt: alternative.copilotPrompt,
                alternatives: nextAction.alternatives?.filter(
                  (entry) => entry.id !== action.alternativeId
                ),
              }
            : nextAction
        ),
        activityMoments: [
          ...state.activityMoments,
          {
            id: makeId("activity"),
            opportunityId: target.opportunityId,
            kind: "action-accepted",
            message: `Accepted the next action: ${alternative.verb}`,
            createdAt: dateStamp,
          },
        ],
      };
    }

    case "REMOVE_NEXT_ACTION":
      return {
        ...state,
        nextActions: state.nextActions.filter((nextAction) => nextAction.id !== action.id),
      };

    case "CONFIRM_TRACK_RECORD_CANDIDATE":
      return {
        ...state,
        trackRecordEntries: state.trackRecordEntries.map((entry) =>
          entry.id === action.id
            ? { ...entry, ...action.patch, status: "confirmed" }
            : entry
        ),
      };

    case "REMOVE_TRACK_RECORD_ENTRY":
      return {
        ...state,
        trackRecordEntries: state.trackRecordEntries.filter((entry) => entry.id !== action.id),
      };

    case "ADD_TRACK_RECORD_ENTRY":
      return {
        ...state,
        trackRecordEntries: [action.entry, ...state.trackRecordEntries],
      };

    case "SET_NUDGE_STATE":
      return {
        ...state,
        nudges: state.nudges.map((nudge) =>
          nudge.id === action.id ? { ...nudge, state: action.state } : nudge
        ),
      };

    case "APPROVE_AI_SIGNAL": {
      const original = state.aiSignals.find((signal) => signal.id === action.id);
      if (!original || original.state !== "proposed") return state;

      // An edited value (from the card's inline Edit control) supersedes
      // the seeded proposal before anything else reads it, so the applied
      // effect, the save-back confirmation, and the Activity log entry all
      // agree on exactly what was accepted.
      const trimmedEdit = action.editedValue?.trim();
      const finalSignal: AiSignal =
        original.kind === "next-action" && trimmedEdit
          ? { ...original, newVerb: trimmedEdit }
          : original.kind === "draft-reply" && trimmedEdit
            ? { ...original, draftText: trimmedEdit }
            : original;

      const dateStamp = today();
      const activityId = makeId("activity");

      let opportunities = state.opportunities;
      let nextActions = state.nextActions;

      if (finalSignal.kind === "next-action") {
        nextActions = nextActions.map((nextAction) =>
          nextAction.id === finalSignal.nextActionId
            ? { ...nextAction, verb: finalSignal.newVerb, rationale: finalSignal.newRationale }
            : nextAction
        );
      } else if (finalSignal.kind === "status-change") {
        opportunities = opportunities.map((opportunity) =>
          opportunity.id === finalSignal.opportunityId
            ? { ...opportunity, status: finalSignal.newStatus, lastActivityAt: dateStamp }
            : opportunity
        );
      } else if (finalSignal.kind === "priority-bump") {
        opportunities = opportunities.map((opportunity) =>
          opportunity.id === finalSignal.opportunityId
            ? { ...opportunity, priority: finalSignal.newPriority }
            : opportunity
        );
        nextActions = [...nextActions, finalSignal.addedNextAction];
      } else if (finalSignal.kind === "draft-reply") {
        nextActions = nextActions.map((nextAction) =>
          nextAction.id === finalSignal.nextActionId ? { ...nextAction, state: "done" } : nextAction
        );
      }

      return {
        ...state,
        opportunities,
        nextActions,
        activityMoments: [
          ...state.activityMoments,
          {
            id: activityId,
            opportunityId: finalSignal.opportunityId,
            kind: "signal-accepted",
            message: buildSignalActivityMessage(finalSignal),
            createdAt: dateStamp,
          },
        ],
        aiSignals: state.aiSignals.map((signal) =>
          signal.id === action.id
            ? { ...finalSignal, state: "approved", appliedActivityMomentId: activityId }
            : signal
        ),
      };
    }

    case "UNDO_AI_SIGNAL": {
      const signal = state.aiSignals.find((entry) => entry.id === action.id);
      if (!signal || signal.state !== "approved") return state;

      let opportunities = state.opportunities;
      let nextActions = state.nextActions;

      if (signal.kind === "next-action") {
        nextActions = nextActions.map((nextAction) =>
          nextAction.id === signal.nextActionId
            ? { ...nextAction, verb: signal.previousVerb, rationale: signal.previousRationale }
            : nextAction
        );
      } else if (signal.kind === "status-change") {
        opportunities = opportunities.map((opportunity) =>
          opportunity.id === signal.opportunityId
            ? { ...opportunity, status: signal.previousStatus }
            : opportunity
        );
      } else if (signal.kind === "priority-bump") {
        opportunities = opportunities.map((opportunity) =>
          opportunity.id === signal.opportunityId
            ? { ...opportunity, priority: signal.previousPriority }
            : opportunity
        );
        nextActions = nextActions.filter((nextAction) => nextAction.id !== signal.addedNextAction.id);
      } else if (signal.kind === "draft-reply") {
        nextActions = nextActions.map((nextAction) =>
          nextAction.id === signal.nextActionId
            ? { ...nextAction, state: signal.previousNextActionState }
            : nextAction
        );
      }

      return {
        ...state,
        opportunities,
        nextActions,
        activityMoments: signal.appliedActivityMomentId
          ? state.activityMoments.filter((moment) => moment.id !== signal.appliedActivityMomentId)
          : state.activityMoments,
        aiSignals: state.aiSignals.map((entry) =>
          entry.id === action.id ? { ...entry, state: "proposed", appliedActivityMomentId: undefined } : entry
        ),
      };
    }

    case "DISMISS_AI_SIGNAL":
      return {
        ...state,
        aiSignals: state.aiSignals.map((signal) =>
          signal.id === action.id ? { ...signal, state: "dismissed" } : signal
        ),
      };

    case "UNDISMISS_AI_SIGNAL":
      return {
        ...state,
        aiSignals: state.aiSignals.map((signal) =>
          signal.id === action.id ? { ...signal, state: "proposed" } : signal
        ),
      };

    case "CONNECT_SOURCE":
      return {
        ...state,
        connectedSources: state.connectedSources.map((source) =>
          source.id === action.id ? { ...source, status: "connected", lastSyncedMinutesAgo: 0 } : source
        ),
      };

    case "LINK_INBOX_ITEM": {
      const dateStamp = today();
      const source = state.connectedSources.find((entry) => entry.id === action.evidence.sourceId);
      const sourceName = source?.name ?? "a connected source";
      const itemLabel = evidenceTitle(action.evidence);

      let trackRecordEntries = state.trackRecordEntries;
      let activityMoments = state.activityMoments;
      let activityMomentId: string | undefined;
      let createdTrackRecordEntryId: string | undefined;
      let linkedTarget: NonNullable<InboxItemLink["linkedTarget"]>;

      if (action.target.type === "opportunity") {
        activityMomentId = makeId("activity");
        activityMoments = [
          ...activityMoments,
          {
            id: activityMomentId,
            opportunityId: action.target.id,
            kind: "evidence-linked",
            message: `Evidence linked from ${sourceName}: ${itemLabel}.`,
            createdAt: dateStamp,
          },
        ];
        linkedTarget = action.target;
      } else if (action.target.type === "goal") {
        linkedTarget = action.target;
      } else {
        const entryId = makeId("tre-inbox");
        const candidate = buildInboxTrackRecordCandidate(action.evidence, sourceName, entryId, dateStamp);
        trackRecordEntries = [candidate, ...trackRecordEntries];
        createdTrackRecordEntryId = candidate.id;
        linkedTarget = { type: "trackRecord", id: candidate.id, label: candidate.title };
      }

      return {
        ...state,
        trackRecordEntries,
        activityMoments,
        inboxItemLinks: {
          ...state.inboxItemLinks,
          [action.evidence.id]: {
            status: "linked",
            linkedTarget,
            activityMomentId,
            createdTrackRecordEntryId,
          },
        },
      };
    }

    case "UNDO_LINK_INBOX_ITEM": {
      const link = state.inboxItemLinks[action.evidenceId];
      if (!link || link.status !== "linked") return state;

      return {
        ...state,
        activityMoments: link.activityMomentId
          ? state.activityMoments.filter((moment) => moment.id !== link.activityMomentId)
          : state.activityMoments,
        trackRecordEntries: link.createdTrackRecordEntryId
          ? state.trackRecordEntries.filter((entry) => entry.id !== link.createdTrackRecordEntryId)
          : state.trackRecordEntries,
        inboxItemLinks: {
          ...state.inboxItemLinks,
          [action.evidenceId]: { status: "needs-review" },
        },
      };
    }

    case "DISMISS_INBOX_ITEM":
      return {
        ...state,
        inboxItemLinks: {
          ...state.inboxItemLinks,
          [action.evidenceId]: { status: "dismissed" },
        },
      };

    case "UNDO_DISMISS_INBOX_ITEM":
      return {
        ...state,
        inboxItemLinks: {
          ...state.inboxItemLinks,
          [action.evidenceId]: { status: "needs-review" },
        },
      };

    case "SET_TAILORING_SUGGESTION_STATE":
      return {
        ...state,
        insights: state.insights.map((insight) => {
          if (insight.id !== action.insightId || insight.kind !== "tailoring") return insight;
          return {
            ...insight,
            suggestions: insight.suggestions.map((suggestion) =>
              suggestion.id === action.suggestionId
                ? { ...suggestion, state: action.state }
                : suggestion
            ),
          };
        }),
      };

    case "ADD_CV_VERSION":
      return { ...state, cvVersions: [action.cv, ...state.cvVersions] };

    case "DELETE_CV_VERSION":
      return {
        ...state,
        cvVersions: state.cvVersions.filter((cv) => cv.id !== action.id),
        opportunities: state.opportunities.map((opportunity) =>
          opportunity.cvVersionId === action.id
            ? { ...opportunity, cvVersionId: undefined }
            : opportunity
        ),
      };

    case "SET_CV_SECTION_CONTENT": {
      const dateStamp = today();
      return {
        ...state,
        cvVersions: state.cvVersions.map((cv) =>
          cv.id === action.cvId
            ? {
                ...cv,
                lastEditedAt: dateStamp,
                sections: cv.sections.map((section) =>
                  section.id === action.sectionId
                    ? { ...section, content: action.content }
                    : section
                ),
              }
            : cv
        ),
      };
    }

    case "SET_CV_OPPORTUNITY_LINK": {
      const dateStamp = today();
      return {
        ...state,
        cvVersions: state.cvVersions.map((cv) =>
          cv.id === action.cvId
            ? {
                ...cv,
                opportunityId: action.opportunityId,
                kind: action.opportunityId ? "tailored" : "base",
                lastEditedAt: dateStamp,
              }
            : cv
        ),
        opportunities: state.opportunities.map((opportunity) => {
          if (opportunity.id === action.opportunityId) {
            return { ...opportunity, cvVersionId: action.cvId };
          }
          if (opportunity.cvVersionId === action.cvId) {
            return { ...opportunity, cvVersionId: undefined };
          }
          return opportunity;
        }),
      };
    }

    case "CREATE_TAILORED_CV_VERSION":
      return {
        ...state,
        cvVersions: [action.cv, ...state.cvVersions],
        opportunities: state.opportunities.map((opportunity) =>
          opportunity.id === action.opportunityId
            ? { ...opportunity, cvVersionId: action.cv.id, lastActivityAt: today() }
            : opportunity
        ),
        activityMoments: [...state.activityMoments, action.activityMoment],
      };

    case "SET_LEARNING_ITEM_STATE":
      return {
        ...state,
        learningItems: state.learningItems.map((item) =>
          item.id === action.id ? { ...item, state: action.state } : item
        ),
      };

    case "SET_WORKING_PATH_SCENARIO":
      return { ...state, workingPathScenarioId: action.scenarioId };

    case "SET_PLAN_ITEM_STATE":
      return {
        ...state,
        planItems: state.planItems.map((item) =>
          item.id === action.id ? { ...item, state: action.state } : item
        ),
      };

    case "TOGGLE_SKILL_FOCUS":
      return {
        ...state,
        skills: state.skills.map((skill) =>
          skill.id === action.id ? { ...skill, isFocus: !skill.isFocus } : skill
        ),
      };

    case "SET_SKILL_HIGHLIGHT":
      return { ...state, highlightedSkillId: action.id };

    case "CLEAR_SKILL_HIGHLIGHT":
      return state.highlightedSkillId === action.id
        ? { ...state, highlightedSkillId: undefined }
        : state;

    case "SET_TRACK_RECORD_HIGHLIGHT":
      return { ...state, highlightedTrackRecordEntryId: action.id };

    case "CLEAR_TRACK_RECORD_HIGHLIGHT":
      return state.highlightedTrackRecordEntryId === action.id
        ? { ...state, highlightedTrackRecordEntryId: undefined }
        : state;

    case "SET_WEEKLY_REVIEW_SUGGESTION_STATE": {
      const suggestion = state.weeklyReview.suggestedFocus.find((entry) => entry.id === action.id);
      const nudgeId = pinnedNudgeId(action.id);

      // Accepting a focus suggestion pins a matching Nudge into the Home
      // attention queue (guarded by id, so accepting twice never duplicates
      // it); toggling back off removes that pinned card again.
      let nudges = state.nudges;
      if (suggestion && action.state === "accepted" && !state.nudges.some((nudge) => nudge.id === nudgeId)) {
        nudges = [...state.nudges, buildPinnedNudgeFromSuggestion(suggestion)];
      } else if (action.state === "dismissed") {
        nudges = state.nudges.filter((nudge) => nudge.id !== nudgeId);
      }

      return {
        ...state,
        nudges,
        weeklyReview: {
          ...state.weeklyReview,
          suggestedFocus: state.weeklyReview.suggestedFocus.map((entry) =>
            entry.id === action.id ? { ...entry, state: action.state } : entry
          ),
        },
      };
    }

    case "SET_WEEKLY_REVIEW_OPEN":
      return { ...state, weeklyReviewOpen: action.open };

    case "MARK_WEEKLY_REVIEW_VIEWED":
      return { ...state, weeklyReviewViewedThisSession: true };

    case "SET_PROFILE_SUMMARY":
      return { ...state, profile: { ...state.profile, summary: action.summary } };

    case "SET_PROFILE_EXPERIENCE_ENTRY":
      return {
        ...state,
        profile: {
          ...state.profile,
          experience: state.profile.experience.map((entry) =>
            entry.id === action.id ? { ...entry, ...action.patch } : entry
          ),
        },
      };

    case "ADD_PROFILE_EXPERIENCE_ENTRY":
      return {
        ...state,
        profile: { ...state.profile, experience: [action.entry, ...state.profile.experience] },
      };

    case "SET_PROFILE_STRENGTHS":
      return { ...state, profile: { ...state.profile, strengths: action.strengths } };

    case "SET_PROFILE_PREFERENCES":
      return {
        ...state,
        profile: {
          ...state.profile,
          preferences: { ...state.profile.preferences, ...action.patch },
        },
      };

    case "SET_COPILOT_OPEN":
      return { ...state, copilot: { ...state.copilot, open: action.open } };

    case "TOGGLE_COPILOT":
      return { ...state, copilot: { ...state.copilot, open: !state.copilot.open } };

    case "SET_COPILOT_SURFACE":
      return {
        ...state,
        copilot: { ...state.copilot, surface: action.surface, objectLabel: action.objectLabel },
      };

    case "ADD_COPILOT_MESSAGE": {
      const existing = state.copilot.messagesBySurface[action.surface] ?? [];
      return {
        ...state,
        copilot: {
          ...state.copilot,
          messagesBySurface: {
            ...state.copilot.messagesBySurface,
            [action.surface]: [...existing, action.message],
          },
        },
      };
    }

    case "SET_COPILOT_THINKING":
      return { ...state, copilot: { ...state.copilot, thinking: action.thinking } };

    case "SET_SIDEBAR_OPEN":
      return { ...state, sidebarOpen: action.open };

    default:
      return state;
  }
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

interface StoreContextValue {
  state: StoreState;
  markOnboarded: () => void;
  resetOnboarding: () => void;
  completeOnboarding: (profilePatch: OnboardingProfilePatch, goals: Goal[]) => void;
  setOpportunityStatus: (id: string, status: OpportunityStatus) => void;
  setOpportunityPriority: (id: string, priority: Priority) => void;
  toggleDream: (id: string) => void;
  setOpportunityNotes: (id: string, notes: string) => void;
  setOpportunitiesView: (view: OpportunitiesView) => void;
  addOpportunity: (
    opportunity: Opportunity,
    insights?: AiInsight[],
    nextAction?: NextAction,
    activityMoments?: ActivityMoment[]
  ) => void;
  clearOpportunityHighlight: (id: string) => void;
  addGoal: (goal: Goal) => void;
  editGoal: (
    id: string,
    patch: Partial<Pick<Goal, "title" | "why" | "targetDate" | "horizon">>
  ) => void;
  parkGoal: (id: string) => void;
  setGoalStatus: (id: string, status: GoalStatus) => void;
  addGoalProgressNote: (id: string, note: string) => void;
  setGoalHighlight: (id: string) => void;
  clearGoalHighlight: (id: string) => void;
  updateTargetDirection: (
    patch: Partial<Pick<Profile, "targetDirection" | "targetDirectionLabel" | "targetDirectionHorizon">>
  ) => void;
  setScenarioAsTargetDirection: (scenario: PathScenario) => void;
  acceptNextAction: (id: string) => void;
  editNextAction: (
    id: string,
    patch: Partial<Pick<NextAction, "verb" | "rationale" | "effort" | "dueHint">>
  ) => void;
  dismissNextAction: (id: string) => void;
  undismissNextAction: (id: string) => void;
  markNextActionDone: (id: string) => void;
  acceptAlternative: (id: string, alternativeId: string) => void;
  removeNextAction: (id: string) => void;
  confirmTrackRecordCandidate: (id: string, patch: TrackRecordConfirmPatch) => void;
  dismissTrackRecordCandidate: (id: string) => void;
  addTrackRecordEntry: (entry: TrackRecordEntry) => void;
  dismissNudge: (id: string) => void;
  snoozeNudge: (id: string) => void;
  markNudgeHandled: (id: string) => void;
  approveAiSignal: (id: string, editedValue?: string) => void;
  undoAiSignal: (id: string) => void;
  dismissAiSignal: (id: string) => void;
  undismissAiSignal: (id: string) => void;
  connectSource: (id: string) => void;
  linkInboxItem: (evidence: SourceEvidence, target: InboxLinkChoice) => void;
  undoLinkInboxItem: (evidenceId: string) => void;
  dismissInboxItem: (evidenceId: string) => void;
  acceptTailoringSuggestion: (insightId: string, suggestionId: string, section: string) => void;
  dismissTailoringSuggestion: (insightId: string, suggestionId: string, section: string) => void;
  addCvVersion: (cv: CvVersion) => void;
  deleteCvVersion: (id: string) => void;
  updateCvSectionContent: (cvId: string, sectionId: string, content: string) => void;
  setCvOpportunityLink: (cvId: string, opportunityId?: string) => void;
  createTailoredCvVersion: (cv: CvVersion, opportunity: Opportunity) => void;
  acceptLearningItem: (id: string) => void;
  dismissLearningItem: (id: string) => void;
  acceptPlanItem: (id: string) => void;
  dismissPlanItem: (id: string) => void;
  toggleSkillFocus: (id: string) => void;
  setSkillHighlight: (id: string) => void;
  clearSkillHighlight: (id: string) => void;
  setTrackRecordHighlight: (id: string) => void;
  clearTrackRecordHighlight: (id: string) => void;
  acceptWeeklyReviewSuggestion: (id: string) => void;
  dismissWeeklyReviewSuggestion: (id: string) => void;
  openWeeklyReview: () => void;
  closeWeeklyReview: () => void;
  markWeeklyReviewViewed: () => void;
  updateProfileSummary: (summary: string) => void;
  updateExperienceEntry: (id: string, patch: Partial<Omit<ExperienceEntry, "id">>) => void;
  addExperienceEntry: (entry: ExperienceEntry) => void;
  updateProfileStrengths: (strengths: string[]) => void;
  updateProfilePreferences: (patch: Partial<ProfilePreferences>) => void;
  setCopilotOpen: (open: boolean) => void;
  toggleCopilot: () => void;
  setCopilotSurface: (surface: string, objectLabel?: string) => void;
  sendCopilotMessage: (text: string) => void;
  setSidebarOpen: (open: boolean) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const thinkingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (thinkingTimeout.current) clearTimeout(thinkingTimeout.current);
    };
  }, []);

  const markOnboarded = useCallback(() => dispatch({ type: "MARK_ONBOARDED" }), []);

  const resetOnboarding = useCallback(() => {
    dispatch({ type: "RESET_ONBOARDING" });
  }, []);

  const completeOnboarding = useCallback((profilePatch: OnboardingProfilePatch, goals: Goal[]) => {
    dispatch({ type: "COMPLETE_ONBOARDING", profilePatch, goals });
    toast.success("Workspace ready");
  }, []);

  const setOpportunityStatus = useCallback(
    (id: string, status: OpportunityStatus) => {
      dispatch({ type: "SET_OPPORTUNITY_STATUS", id, status });
      toast.success(`Opportunity moved to ${status}`);
    },
    []
  );

  const setOpportunityPriority = useCallback((id: string, priority: Priority) => {
    dispatch({ type: "SET_OPPORTUNITY_PRIORITY", id, priority });
    toast.success(`Priority set to ${priority}`);
  }, []);

  const toggleDream = useCallback((id: string) => {
    dispatch({ type: "TOGGLE_OPPORTUNITY_DREAM", id });
  }, []);

  const setOpportunityNotes = useCallback((id: string, notes: string) => {
    dispatch({ type: "SET_OPPORTUNITY_NOTES", id, notes });
    toast.success("Note saved");
  }, []);

  const setOpportunitiesView = useCallback((view: OpportunitiesView) => {
    dispatch({ type: "SET_OPPORTUNITIES_VIEW", view });
  }, []);

  const addOpportunity = useCallback(
    (
      opportunity: Opportunity,
      insights?: AiInsight[],
      nextAction?: NextAction,
      activityMoments?: ActivityMoment[]
    ) => {
      dispatch({ type: "ADD_OPPORTUNITY", opportunity, insights, nextAction, activityMoments });
      toast.success("Opportunity added", {
        description: `${opportunity.role} at ${opportunity.company} is now in Saved.`,
        action: {
          label: "Open",
          onClick: () => router.push(`/opportunities/${opportunity.id}`),
        },
      });
    },
    [router]
  );

  const clearOpportunityHighlight = useCallback((id: string) => {
    dispatch({ type: "CLEAR_OPPORTUNITY_HIGHLIGHT", id });
  }, []);

  const addGoal = useCallback((goal: Goal) => {
    dispatch({ type: "ADD_GOAL", goal });
    toast.success("Goal added");
  }, []);

  const editGoal = useCallback(
    (id: string, patch: Partial<Pick<Goal, "title" | "why" | "targetDate" | "horizon">>) => {
      dispatch({ type: "EDIT_GOAL", id, patch });
      toast.success("Goal updated");
    },
    []
  );

  const setGoalStatus = useCallback((id: string, status: GoalStatus) => {
    dispatch({ type: "SET_GOAL_STATUS", id, status });
    toast.success(`Goal status set to ${status}`);
  }, []);

  const parkGoal = useCallback((id: string) => {
    dispatch({ type: "SET_GOAL_STATUS", id, status: "parked" });
    toast("Goal parked");
  }, []);

  const addGoalProgressNote = useCallback((id: string, note: string) => {
    const trimmed = note.trim();
    if (!trimmed) return;
    dispatch({
      type: "ADD_GOAL_PROGRESS_NOTE",
      id,
      note: { id: makeId("goal-note"), note: trimmed, createdAt: today() },
    });
    toast.success("Progress note added");
  }, []);

  const setGoalHighlight = useCallback((id: string) => {
    dispatch({ type: "SET_GOAL_HIGHLIGHT", id });
  }, []);

  const clearGoalHighlight = useCallback((id: string) => {
    dispatch({ type: "CLEAR_GOAL_HIGHLIGHT", id });
  }, []);

  const updateTargetDirection = useCallback(
    (patch: Partial<Pick<Profile, "targetDirection" | "targetDirectionLabel" | "targetDirectionHorizon">>) => {
      dispatch({ type: "UPDATE_TARGET_DIRECTION", patch });
      toast.success("Target direction updated");
    },
    []
  );

  // Shared by Goals' path scenario cards and the Path Planner's alternatives
  // comparison: choosing a scenario as the working path updates both the
  // target direction (read by Home, Profile, Goals) and the planner's
  // working path in one action, so the two surfaces never disagree about
  // which scenario is currently active.
  const setScenarioAsTargetDirection = useCallback((scenario: PathScenario) => {
    dispatch({ type: "SET_WORKING_PATH_SCENARIO", scenarioId: scenario.id });
    dispatch({
      type: "UPDATE_TARGET_DIRECTION",
      patch: { targetDirection: scenario.description, targetDirectionLabel: scenario.title },
    });
    toast.success("Target direction updated", {
      description: `Now steering toward ${scenario.title}.`,
    });
  }, []);

  const acceptNextAction = useCallback((id: string) => {
    dispatch({ type: "SET_NEXT_ACTION_STATE", id, state: "accepted" });
    toast.success("Next action accepted");
  }, []);

  const editNextAction = useCallback(
    (id: string, patch: Partial<Pick<NextAction, "verb" | "rationale" | "effort" | "dueHint">>) => {
      dispatch({ type: "EDIT_NEXT_ACTION", id, patch });
      toast.success("Next action updated");
    },
    []
  );

  const dismissNextAction = useCallback((id: string) => {
    dispatch({ type: "SET_NEXT_ACTION_STATE", id, state: "dismissed" });
    toast("Next action dismissed", {
      action: {
        label: "Undo",
        onClick: () => dispatch({ type: "SET_NEXT_ACTION_STATE", id, state: "suggested" }),
      },
    });
  }, []);

  const undismissNextAction = useCallback((id: string) => {
    dispatch({ type: "SET_NEXT_ACTION_STATE", id, state: "suggested" });
  }, []);

  const markNextActionDone = useCallback((id: string) => {
    dispatch({ type: "SET_NEXT_ACTION_STATE", id, state: "done" });
    toast.success("Next action marked done");
  }, []);

  const acceptAlternative = useCallback((id: string, alternativeId: string) => {
    dispatch({ type: "ACCEPT_ALTERNATIVE", id, alternativeId });
    toast.success("Switched to the alternative path");
  }, []);

  const removeNextAction = useCallback((id: string) => {
    dispatch({ type: "REMOVE_NEXT_ACTION", id });
    toast("Removed from your plan");
  }, []);

  const confirmTrackRecordCandidate = useCallback((id: string, patch: TrackRecordConfirmPatch) => {
    dispatch({ type: "CONFIRM_TRACK_RECORD_CANDIDATE", id, patch });
    toast.success("Added to Track Record");
  }, []);

  const dismissTrackRecordCandidate = useCallback(
    (id: string) => {
      const entry = state.trackRecordEntries.find((candidate) => candidate.id === id);
      dispatch({ type: "REMOVE_TRACK_RECORD_ENTRY", id });
      toast("Candidate dismissed", {
        action: entry
          ? {
              label: "Undo",
              onClick: () => dispatch({ type: "ADD_TRACK_RECORD_ENTRY", entry }),
            }
          : undefined,
      });
    },
    [state.trackRecordEntries]
  );

  const addTrackRecordEntry = useCallback((entry: TrackRecordEntry) => {
    dispatch({ type: "ADD_TRACK_RECORD_ENTRY", entry });
    toast.success("Added to Track Record");
  }, []);

  const dismissNudge = useCallback((id: string) => {
    dispatch({ type: "SET_NUDGE_STATE", id, state: "dismissed" });
    toast("Nudge dismissed", {
      action: {
        label: "Undo",
        onClick: () => dispatch({ type: "SET_NUDGE_STATE", id, state: "active" }),
      },
    });
  }, []);

  const snoozeNudge = useCallback((id: string) => {
    dispatch({ type: "SET_NUDGE_STATE", id, state: "snoozed" });
    toast("Nudge snoozed for later", {
      action: {
        label: "Undo",
        onClick: () => dispatch({ type: "SET_NUDGE_STATE", id, state: "active" }),
      },
    });
  }, []);

  // Marks an item handled once its Act deep link is taken: no toast, since
  // the card's own check state already gives the confirmation before it
  // leaves the queue.
  const markNudgeHandled = useCallback((id: string) => {
    dispatch({ type: "SET_NUDGE_STATE", id, state: "dismissed" });
  }, []);

  // Approve shows its own in-card save-back confirmation with Undo, so no
  // extra toast here, that would just repeat what the card already says.
  const approveAiSignal = useCallback((id: string, editedValue?: string) => {
    dispatch({ type: "APPROVE_AI_SIGNAL", id, editedValue });
  }, []);

  const undoAiSignal = useCallback((id: string) => {
    dispatch({ type: "UNDO_AI_SIGNAL", id });
  }, []);

  const dismissAiSignal = useCallback((id: string) => {
    dispatch({ type: "DISMISS_AI_SIGNAL", id });
    toast("Signal dismissed", {
      action: {
        label: "Undo",
        onClick: () => dispatch({ type: "UNDISMISS_AI_SIGNAL", id }),
      },
    });
  }, []);

  const undismissAiSignal = useCallback((id: string) => {
    dispatch({ type: "UNDISMISS_AI_SIGNAL", id });
  }, []);

  const connectSource = useCallback((id: string) => {
    dispatch({ type: "CONNECT_SOURCE", id });
  }, []);

  // The linked item also shows an inline save-back confirmation with Undo
  // wherever it stays visible (the Linked filter, or an object's own linked
  // evidence list), the same pattern SignalCard's approve uses. But linking
  // moves the item out of the default Needs review filter immediately, so
  // unlike an approved signal it doesn't stay in place to show that inline
  // confirmation there, hence the toast here too.
  const linkInboxItem = useCallback((evidence: SourceEvidence, target: InboxLinkChoice) => {
    dispatch({ type: "LINK_INBOX_ITEM", evidence, target });
    const label = target.type === "trackRecord" ? evidenceTitle(evidence) : target.label;
    toast.success(`Linked to ${label} as evidence.`, {
      action: {
        label: "Undo",
        onClick: () => dispatch({ type: "UNDO_LINK_INBOX_ITEM", evidenceId: evidence.id }),
      },
    });
  }, []);

  const undoLinkInboxItem = useCallback((evidenceId: string) => {
    dispatch({ type: "UNDO_LINK_INBOX_ITEM", evidenceId });
  }, []);

  const dismissInboxItem = useCallback((evidenceId: string) => {
    dispatch({ type: "DISMISS_INBOX_ITEM", evidenceId });
    toast("Marked not relevant", {
      action: {
        label: "Undo",
        onClick: () => dispatch({ type: "UNDO_DISMISS_INBOX_ITEM", evidenceId }),
      },
    });
  }, []);

  const acceptTailoringSuggestion = useCallback((insightId: string, suggestionId: string, section: string) => {
    dispatch({ type: "SET_TAILORING_SUGGESTION_STATE", insightId, suggestionId, state: "accepted" });
    toast.success(`${section} suggestion accepted`);
  }, []);

  const dismissTailoringSuggestion = useCallback((insightId: string, suggestionId: string, section: string) => {
    dispatch({ type: "SET_TAILORING_SUGGESTION_STATE", insightId, suggestionId, state: "dismissed" });
    toast(`${section} suggestion dismissed`);
  }, []);

  const addCvVersion = useCallback(
    (cv: CvVersion) => {
      dispatch({ type: "ADD_CV_VERSION", cv });
      toast.success("CV version created", {
        description: `${cv.name} is ready to edit.`,
        action: {
          label: "Open",
          onClick: () => router.push(`/cvs/${cv.id}`),
        },
      });
    },
    [router]
  );

  const deleteCvVersion = useCallback((id: string) => {
    dispatch({ type: "DELETE_CV_VERSION", id });
    toast("CV version deleted");
  }, []);

  const updateCvSectionContent = useCallback((cvId: string, sectionId: string, content: string) => {
    dispatch({ type: "SET_CV_SECTION_CONTENT", cvId, sectionId, content });
    toast.success("Section saved");
  }, []);

  const setCvOpportunityLink = useCallback((cvId: string, opportunityId?: string) => {
    dispatch({ type: "SET_CV_OPPORTUNITY_LINK", cvId, opportunityId });
    toast.success(opportunityId ? "Linked to opportunity" : "Opportunity link cleared");
  }, []);

  const createTailoredCvVersion = useCallback(
    (cv: CvVersion, opportunity: Opportunity) => {
      const activityMoment: ActivityMoment = {
        id: makeId("activity"),
        opportunityId: opportunity.id,
        kind: "cv-tailored",
        message: `Copilot created a tailored CV version: ${cv.name}.`,
        createdAt: today(),
      };
      dispatch({ type: "CREATE_TAILORED_CV_VERSION", cv, opportunityId: opportunity.id, activityMoment });
      toast.success("Tailored version created", {
        description: `${cv.name} is now linked to ${opportunity.company}.`,
      });
      router.push(`/cvs/${cv.id}`);
    },
    [router]
  );

  const acceptLearningItem = useCallback((id: string) => {
    dispatch({ type: "SET_LEARNING_ITEM_STATE", id, state: "planned" });
    toast.success("Added to your learning plan");
  }, []);

  const dismissLearningItem = useCallback((id: string) => {
    dispatch({ type: "SET_LEARNING_ITEM_STATE", id, state: "dismissed" });
    toast("Learning item dismissed", {
      action: {
        label: "Undo",
        onClick: () => dispatch({ type: "SET_LEARNING_ITEM_STATE", id, state: "suggested" }),
      },
    });
  }, []);

  // Accepting a "learn" type plan item also plans the linked learning item,
  // the same store action Skills & Learning's own accept uses, so it shows
  // up there too rather than only inside the planner's own collection.
  const acceptPlanItem = useCallback(
    (id: string) => {
      const item = state.planItems.find((entry) => entry.id === id);
      dispatch({ type: "SET_PLAN_ITEM_STATE", id, state: "accepted" });
      if (item?.linkedLearningItemId) {
        dispatch({ type: "SET_LEARNING_ITEM_STATE", id: item.linkedLearningItemId, state: "planned" });
      }
      toast.success("Added to growth plan", {
        description: item?.linkedLearningItemId ? "Also added to your Skills & Learning plan." : undefined,
      });
    },
    [state.planItems]
  );

  const dismissPlanItem = useCallback((id: string) => {
    dispatch({ type: "SET_PLAN_ITEM_STATE", id, state: "dismissed" });
    toast("Removed from growth plan", {
      action: {
        label: "Undo",
        onClick: () => dispatch({ type: "SET_PLAN_ITEM_STATE", id, state: "suggested" }),
      },
    });
  }, []);

  const toggleSkillFocus = useCallback((id: string) => {
    dispatch({ type: "TOGGLE_SKILL_FOCUS", id });
  }, []);

  const setSkillHighlight = useCallback((id: string) => {
    dispatch({ type: "SET_SKILL_HIGHLIGHT", id });
  }, []);

  const clearSkillHighlight = useCallback((id: string) => {
    dispatch({ type: "CLEAR_SKILL_HIGHLIGHT", id });
  }, []);

  const setTrackRecordHighlight = useCallback((id: string) => {
    dispatch({ type: "SET_TRACK_RECORD_HIGHLIGHT", id });
  }, []);

  const clearTrackRecordHighlight = useCallback((id: string) => {
    dispatch({ type: "CLEAR_TRACK_RECORD_HIGHLIGHT", id });
  }, []);

  const acceptWeeklyReviewSuggestion = useCallback((id: string) => {
    dispatch({ type: "SET_WEEKLY_REVIEW_SUGGESTION_STATE", id, state: "accepted" });
    toast.success("Pinned to your attention queue");
  }, []);

  const dismissWeeklyReviewSuggestion = useCallback((id: string) => {
    dispatch({ type: "SET_WEEKLY_REVIEW_SUGGESTION_STATE", id, state: "dismissed" });
    toast("Removed from focus for next week");
  }, []);

  const openWeeklyReview = useCallback(() => {
    dispatch({ type: "SET_WEEKLY_REVIEW_OPEN", open: true });
  }, []);

  const closeWeeklyReview = useCallback(() => {
    dispatch({ type: "SET_WEEKLY_REVIEW_OPEN", open: false });
  }, []);

  const markWeeklyReviewViewed = useCallback(() => {
    dispatch({ type: "MARK_WEEKLY_REVIEW_VIEWED" });
  }, []);

  const updateProfileSummary = useCallback((summary: string) => {
    dispatch({ type: "SET_PROFILE_SUMMARY", summary });
    toast.success("Summary saved");
  }, []);

  const updateExperienceEntry = useCallback(
    (id: string, patch: Partial<Omit<ExperienceEntry, "id">>) => {
      dispatch({ type: "SET_PROFILE_EXPERIENCE_ENTRY", id, patch });
      toast.success("Experience saved");
    },
    []
  );

  const addExperienceEntry = useCallback((entry: ExperienceEntry) => {
    dispatch({ type: "ADD_PROFILE_EXPERIENCE_ENTRY", entry });
    toast.success("Experience added");
  }, []);

  const updateProfileStrengths = useCallback((strengths: string[]) => {
    dispatch({ type: "SET_PROFILE_STRENGTHS", strengths });
    toast.success("Strengths saved");
  }, []);

  const updateProfilePreferences = useCallback((patch: Partial<ProfilePreferences>) => {
    dispatch({ type: "SET_PROFILE_PREFERENCES", patch });
    toast.success("Preferences saved");
  }, []);

  const setCopilotOpen = useCallback((open: boolean) => dispatch({ type: "SET_COPILOT_OPEN", open }), []);
  const toggleCopilot = useCallback(() => dispatch({ type: "TOGGLE_COPILOT" }), []);
  const setSidebarOpen = useCallback((open: boolean) => dispatch({ type: "SET_SIDEBAR_OPEN", open }), []);

  const setCopilotSurface = useCallback((surface: string, objectLabel?: string) => {
    dispatch({ type: "SET_COPILOT_SURFACE", surface, objectLabel });
  }, []);

  const sendCopilotMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const surface = state.copilot.surface;
      const userMessage: CopilotMessage = {
        id: makeId("msg"),
        role: "user",
        text: trimmed,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_COPILOT_MESSAGE", surface, message: userMessage });
      dispatch({ type: "SET_COPILOT_THINKING", thinking: true });

      const script = copilotScripts.find((entry) => entry.surface === surface);
      const matchedExchange = script?.exchanges.find(
        (exchange) => exchange.prompt.toLowerCase() === trimmed.toLowerCase()
      );
      // The graceful limit state: any free-typed input that doesn't match a
      // scripted prompt gets one honest line back, plus this surface's
      // suggested prompts stay visible below for the user to pick instead.
      const response: CopilotResponse = matchedExchange?.response ?? {
        lead: "In this prototype I only handle the suggested prompts, pick one below.",
      };

      const delay = 600 + Math.random() * 600;
      if (thinkingTimeout.current) clearTimeout(thinkingTimeout.current);
      thinkingTimeout.current = setTimeout(() => {
        const copilotMessage: CopilotMessage = {
          id: makeId("msg"),
          role: "copilot",
          text: response.lead,
          response,
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "ADD_COPILOT_MESSAGE", surface, message: copilotMessage });
        dispatch({ type: "SET_COPILOT_THINKING", thinking: false });
      }, delay);
    },
    [state.copilot.surface]
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      markOnboarded,
      resetOnboarding,
      completeOnboarding,
      setOpportunityStatus,
      setOpportunityPriority,
      toggleDream,
      setOpportunityNotes,
      setOpportunitiesView,
      addOpportunity,
      clearOpportunityHighlight,
      addGoal,
      editGoal,
      parkGoal,
      setGoalStatus,
      addGoalProgressNote,
      setGoalHighlight,
      clearGoalHighlight,
      updateTargetDirection,
      setScenarioAsTargetDirection,
      acceptNextAction,
      editNextAction,
      dismissNextAction,
      undismissNextAction,
      markNextActionDone,
      acceptAlternative,
      removeNextAction,
      confirmTrackRecordCandidate,
      dismissTrackRecordCandidate,
      addTrackRecordEntry,
      dismissNudge,
      snoozeNudge,
      markNudgeHandled,
      approveAiSignal,
      undoAiSignal,
      dismissAiSignal,
      undismissAiSignal,
      connectSource,
      linkInboxItem,
      undoLinkInboxItem,
      dismissInboxItem,
      acceptTailoringSuggestion,
      dismissTailoringSuggestion,
      addCvVersion,
      deleteCvVersion,
      updateCvSectionContent,
      setCvOpportunityLink,
      createTailoredCvVersion,
      acceptLearningItem,
      dismissLearningItem,
      acceptPlanItem,
      dismissPlanItem,
      toggleSkillFocus,
      setSkillHighlight,
      clearSkillHighlight,
      setTrackRecordHighlight,
      clearTrackRecordHighlight,
      acceptWeeklyReviewSuggestion,
      dismissWeeklyReviewSuggestion,
      openWeeklyReview,
      closeWeeklyReview,
      markWeeklyReviewViewed,
      updateProfileSummary,
      updateExperienceEntry,
      addExperienceEntry,
      updateProfileStrengths,
      updateProfilePreferences,
      setCopilotOpen,
      toggleCopilot,
      setCopilotSurface,
      sendCopilotMessage,
      setSidebarOpen,
    }),
    [
      state,
      markOnboarded,
      resetOnboarding,
      completeOnboarding,
      setOpportunityStatus,
      setOpportunityPriority,
      toggleDream,
      setOpportunityNotes,
      setOpportunitiesView,
      addOpportunity,
      clearOpportunityHighlight,
      addGoal,
      editGoal,
      parkGoal,
      setGoalStatus,
      addGoalProgressNote,
      setGoalHighlight,
      clearGoalHighlight,
      updateTargetDirection,
      setScenarioAsTargetDirection,
      acceptNextAction,
      editNextAction,
      dismissNextAction,
      undismissNextAction,
      markNextActionDone,
      acceptAlternative,
      removeNextAction,
      confirmTrackRecordCandidate,
      dismissTrackRecordCandidate,
      addTrackRecordEntry,
      dismissNudge,
      snoozeNudge,
      markNudgeHandled,
      approveAiSignal,
      undoAiSignal,
      dismissAiSignal,
      undismissAiSignal,
      connectSource,
      linkInboxItem,
      undoLinkInboxItem,
      dismissInboxItem,
      acceptTailoringSuggestion,
      dismissTailoringSuggestion,
      addCvVersion,
      deleteCvVersion,
      updateCvSectionContent,
      setCvOpportunityLink,
      createTailoredCvVersion,
      acceptLearningItem,
      dismissLearningItem,
      acceptPlanItem,
      dismissPlanItem,
      toggleSkillFocus,
      setSkillHighlight,
      clearSkillHighlight,
      setTrackRecordHighlight,
      clearTrackRecordHighlight,
      acceptWeeklyReviewSuggestion,
      dismissWeeklyReviewSuggestion,
      openWeeklyReview,
      closeWeeklyReview,
      markWeeklyReviewViewed,
      updateProfileSummary,
      updateExperienceEntry,
      addExperienceEntry,
      updateProfileStrengths,
      updateProfilePreferences,
      setCopilotOpen,
      toggleCopilot,
      setCopilotSurface,
      sendCopilotMessage,
      setSidebarOpen,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}

export function useCopilotSurface(surface: string, objectLabel?: string) {
  const { setCopilotSurface } = useStore();
  useEffect(() => {
    setCopilotSurface(surface, objectLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, objectLabel]);
}
