// Every action the store's reducer accepts, grouped in the same order the
// domain reducer files under lib/store/reducers/ handle them. One shared
// union so lib/store/reducer.ts can narrow it per case and each domain
// reducer can declare exactly the slice it needs with Extract<Action, ...>.

import type {
  ActivityMoment,
  AiInsight,
  CopilotMessage,
  CvVersion,
  ExperienceEntry,
  Goal,
  GoalProgressNote,
  GoalStatus,
  InboxLinkChoice,
  LearningItem,
  NextAction,
  NextActionState,
  Nudge,
  Opportunity,
  OpportunityStatus,
  OpportunityPositioningNote,
  PlanItem,
  PlanItemState,
  Priority,
  Profile,
  ProfilePreferences,
  ProofSaveBackUndo,
  ProofTransformationState,
  RecruiterStage,
  RecruiterStageHistoryEntry,
  RewindCandidateState,
  RewindCarryForwardState,
  RoadmapResourceState,
  SourceEvidence,
  TrackRecordEntry,
} from "@/lib/types";
import type { OnboardingProfilePatch, OpportunitiesView, TrackRecordConfirmPatch } from "./state";

export type Action =
  // onboarding
  | { type: "MARK_ONBOARDED" }
  | { type: "RESET_ONBOARDING" }
  | { type: "COMPLETE_ONBOARDING"; profilePatch: OnboardingProfilePatch; goals: Goal[] }
  // opportunities + next actions
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
  | { type: "SET_COMPARISON_MODE"; active: boolean }
  | { type: "SET_COMPARISON_SELECTION"; ids: string[] }
  | { type: "TOGGLE_COMPARISON_SELECTION"; id: string }
  | {
      type: "FOCUS_OPPORTUNITY_FROM_COMPARISON";
      id: string;
      activityMoment: ActivityMoment;
      pinNextActionId?: string;
    }
  | {
      type: "UNDO_FOCUS_OPPORTUNITY_FROM_COMPARISON";
      id: string;
      activityMomentId: string;
      previousPriority: Priority;
      nextActionId?: string;
      previousNextActionState?: NextActionState;
    }
  | { type: "SET_NEXT_ACTION_STATE"; id: string; state: NextActionState }
  | {
      type: "EDIT_NEXT_ACTION";
      id: string;
      patch: Partial<Pick<NextAction, "verb" | "rationale" | "effort" | "dueHint">>;
    }
  | { type: "ACCEPT_ALTERNATIVE"; id: string; alternativeId: string }
  | { type: "REMOVE_NEXT_ACTION"; id: string }
  // AI signals + connected sources / synced-context inbox
  | { type: "APPROVE_AI_SIGNAL"; id: string; editedValue?: string }
  | { type: "UNDO_AI_SIGNAL"; id: string }
  | { type: "DISMISS_AI_SIGNAL"; id: string }
  | { type: "UNDISMISS_AI_SIGNAL"; id: string }
  | { type: "CONNECT_SOURCE"; id: string }
  | { type: "LINK_INBOX_ITEM"; evidence: SourceEvidence; target: InboxLinkChoice }
  | { type: "UNDO_LINK_INBOX_ITEM"; evidenceId: string }
  | { type: "DISMISS_INBOX_ITEM"; evidenceId: string }
  | { type: "UNDO_DISMISS_INBOX_ITEM"; evidenceId: string }
  // CVs
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
  // proof builder
  | { type: "SET_PROOF_TRANSFORMATION_STATE"; id: string; state: ProofTransformationState }
  | {
      type: "ACCEPT_PROOF_TRANSFORMATION";
      id: string;
      groundedProof: string;
      saveBackUndo: ProofSaveBackUndo;
      activityMoment?: ActivityMoment;
      addedNote?: OpportunityPositioningNote;
      addedPlanItem?: PlanItem;
    }
  | { type: "UNDO_PROOF_TRANSFORMATION"; id: string }
  // direction: goals, path planner, roadmap, skills & learning
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
  | { type: "SET_LEARNING_ITEM_STATE"; id: string; state: LearningItem["state"] }
  | { type: "SET_WORKING_PATH_SCENARIO"; scenarioId: string }
  | { type: "SET_PLAN_ITEM_STATE"; id: string; state: PlanItemState }
  | {
      type: "ADD_ROADMAP_RESOURCE_TO_PLAN";
      resourceId: string;
      planItem: PlanItem;
      learningItem: LearningItem;
    }
  | { type: "SET_ROADMAP_RESOURCE_STATE"; id: string; state: RoadmapResourceState }
  | { type: "TOGGLE_SKILL_FOCUS"; id: string }
  | { type: "SET_SKILL_HIGHLIGHT"; id: string }
  | { type: "CLEAR_SKILL_HIGHLIGHT"; id: string }
  // track record + rewind
  | {
      type: "CONFIRM_TRACK_RECORD_CANDIDATE";
      id: string;
      patch: TrackRecordConfirmPatch;
    }
  | { type: "REMOVE_TRACK_RECORD_ENTRY"; id: string }
  | { type: "ADD_TRACK_RECORD_ENTRY"; entry: TrackRecordEntry }
  | { type: "SET_TRACK_RECORD_HIGHLIGHT"; id: string }
  | { type: "CLEAR_TRACK_RECORD_HIGHLIGHT"; id: string }
  | { type: "SAVE_REWIND_CANDIDATE"; candidateId: string; entry: TrackRecordEntry }
  | { type: "SET_REWIND_CANDIDATE_STATE"; id: string; state: RewindCandidateState }
  | { type: "SET_REWIND_CARRY_FORWARD_STATE"; id: string; state: RewindCarryForwardState }
  | { type: "MARK_REWIND_VIEWED" }
  // strategy (weekly focus plan)
  | {
      type: "APPLY_STRATEGY_MOVE";
      moveId: string;
      opportunityId?: string;
      nextActionId?: string;
      newPriority?: Priority;
      previousPriority?: Priority;
      activityMoment?: ActivityMoment;
    }
  | {
      type: "UNDO_STRATEGY_MOVE";
      moveId: string;
      opportunityId?: string;
      nextActionId?: string;
      previousPriority?: Priority;
      activityMomentId?: string;
    }
  | { type: "DISMISS_STRATEGY_MOVE"; moveId: string }
  | { type: "UNDISMISS_STRATEGY_MOVE"; moveId: string }
  // profile
  | { type: "SET_PROFILE_SUMMARY"; summary: string }
  | { type: "SET_PROFILE_EXPERIENCE_ENTRY"; id: string; patch: Partial<Omit<ExperienceEntry, "id">> }
  | { type: "ADD_PROFILE_EXPERIENCE_ENTRY"; entry: ExperienceEntry }
  | { type: "SET_PROFILE_STRENGTHS"; strengths: string[] }
  | { type: "SET_PROFILE_PREFERENCES"; patch: Partial<ProfilePreferences> }
  // shell: nudges, copilot panel, sidebar
  | { type: "SET_NUDGE_STATE"; id: string; state: Nudge["state"] }
  | { type: "SET_COPILOT_OPEN"; open: boolean }
  | { type: "TOGGLE_COPILOT" }
  | { type: "SET_SIDEBAR_OPEN"; open: boolean }
  | { type: "SET_COPILOT_SURFACE"; surface: string; objectLabel?: string }
  | { type: "ADD_COPILOT_MESSAGE"; surface: string; message: CopilotMessage }
  | { type: "SET_COPILOT_THINKING"; thinking: boolean }
  // recruiter mode (RDS-988), its own domain, never mixed with the actions above
  | { type: "ADVANCE_RECRUITER_CANDIDATE_STAGE"; id: string; stage: RecruiterStage; historyEntry: RecruiterStageHistoryEntry }
  | { type: "TOGGLE_RECRUITER_CANDIDATE_FLAG"; id: string }
  | { type: "SET_RECRUITER_CANDIDATE_NOTES"; id: string; notes: string };
