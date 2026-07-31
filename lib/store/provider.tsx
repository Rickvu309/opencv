"use client";

// The store's React binding: one context, one reducer (lib/store/reducer.ts,
// itself routing to the domain files under lib/store/reducers/), and one
// action-creator per user-facing operation. Each creator dispatches, then
// (where the five-beat pattern's inline confirmation doesn't already cover
// it) shows the one shared toast pattern. Kept as a single provider despite
// the reducer split above it: every creator here reads and writes the same
// one store, and splitting the creators themselves added indirection
// without making any of them easier to find (they're already grouped by
// domain, in the same order as the reducer files, and every one is a
// two-to-six line function).

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

import { copilotScripts } from "@/lib/data/copilot-scripts";
import { joinWithAnd } from "@/lib/comparison-utils";
import { evidenceTitle } from "@/lib/inbox-utils";
import { findPrimaryNextAction } from "@/lib/opportunity-utils";
import { resourceToLearningItemType, resourceToPlanItemType } from "@/lib/roadmap-utils";
import { makeId, today } from "@/lib/store/helpers";
import { reducer } from "@/lib/store/reducer";
import {
  initialState,
  type OnboardingProfilePatch,
  type OpportunitiesView,
  type StoreState,
  type TrackRecordConfirmPatch,
} from "@/lib/store/state";
import type {
  ActivityMoment,
  AiInsight,
  CopilotMessage,
  CopilotResponse,
  CvVersion,
  ExperienceEntry,
  Goal,
  GoalStatus,
  InboxLinkChoice,
  LearningItem,
  NextAction,
  NextActionState,
  Opportunity,
  OpportunityStatus,
  PathScenario,
  PlanItem,
  Priority,
  Profile,
  ProfilePreferences,
  RoadmapResource,
  SourceEvidence,
  TrackRecordEntry,
} from "@/lib/types";

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
  setComparisonMode: (active: boolean) => void;
  setComparisonSelection: (ids: string[]) => void;
  toggleComparisonSelection: (id: string) => void;
  focusOpportunityFromComparison: (
    opportunity: Opportunity,
    comparedOpportunities: Opportunity[]
  ) => {
    activityMomentId: string;
    previousPriority: Priority;
    nextActionId?: string;
    previousNextActionState?: NextActionState;
    priorityChanged: boolean;
    nextActionPinned: boolean;
  };
  undoFocusOpportunityFromComparison: (
    id: string,
    undo: {
      activityMomentId: string;
      previousPriority: Priority;
      nextActionId?: string;
      previousNextActionState?: NextActionState;
    }
  ) => void;
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
  addRoadmapResourceToPlan: (resource: RoadmapResource) => void;
  dismissRoadmapResource: (id: string) => void;
  toggleSkillFocus: (id: string) => void;
  setSkillHighlight: (id: string) => void;
  clearSkillHighlight: (id: string) => void;
  setTrackRecordHighlight: (id: string) => void;
  clearTrackRecordHighlight: (id: string) => void;
  saveRewindCandidate: (candidateId: string, entry: TrackRecordEntry) => void;
  dismissRewindCandidate: (id: string) => void;
  deferRewindCandidate: (id: string) => void;
  resetRewindCandidate: (id: string) => void;
  acceptRewindCarryForward: (id: string) => void;
  dismissRewindCarryForward: (id: string) => void;
  undoRewindCarryForward: (id: string) => void;
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

  const setComparisonMode = useCallback((active: boolean) => {
    dispatch({ type: "SET_COMPARISON_MODE", active });
  }, []);

  const setComparisonSelection = useCallback((ids: string[]) => {
    dispatch({ type: "SET_COMPARISON_SELECTION", ids });
  }, []);

  const toggleComparisonSelection = useCallback((id: string) => {
    dispatch({ type: "TOGGLE_COMPARISON_SELECTION", id });
  }, []);

  // Applies the comparison workspace's "Make this my focus" decision: raises
  // priority to High, pins the primary next action into Home's accepted
  // list (if one exists and isn't already accepted or done), and logs an
  // Activity moment naming who it was chosen over. Returns exactly what
  // changed so the caller's SaveBackConfirmation can name it and, if the
  // user hits Undo, hand the same values back to undoFocusOpportunityFromComparison.
  const focusOpportunityFromComparison = useCallback(
    (opportunity: Opportunity, comparedOpportunities: Opportunity[]) => {
      const previousPriority = opportunity.priority;
      const primaryAction = findPrimaryNextAction(opportunity.id, state.nextActions);
      const previousNextActionState = primaryAction?.state;
      const shouldPin = Boolean(
        primaryAction && primaryAction.state !== "accepted" && primaryAction.state !== "done"
      );

      const activityMoment: ActivityMoment = {
        id: makeId("activity"),
        opportunityId: opportunity.id,
        kind: "comparison-decision",
        message: `Chosen over ${joinWithAnd(comparedOpportunities.map((entry) => entry.company))} after comparison.`,
        createdAt: today(),
      };

      dispatch({
        type: "FOCUS_OPPORTUNITY_FROM_COMPARISON",
        id: opportunity.id,
        activityMoment,
        pinNextActionId: shouldPin ? primaryAction!.id : undefined,
      });

      return {
        activityMomentId: activityMoment.id,
        previousPriority,
        nextActionId: shouldPin ? primaryAction!.id : undefined,
        previousNextActionState,
        priorityChanged: previousPriority !== "High",
        nextActionPinned: shouldPin,
      };
    },
    [state.nextActions]
  );

  const undoFocusOpportunityFromComparison = useCallback(
    (
      id: string,
      undo: {
        activityMomentId: string;
        previousPriority: Priority;
        nextActionId?: string;
        previousNextActionState?: NextActionState;
      }
    ) => {
      dispatch({ type: "UNDO_FOCUS_OPPORTUNITY_FROM_COMPARISON", id, ...undo });
    },
    []
  );

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

  // Turns a roadmap resource into a real PlanItem (in its milestone's
  // planStage) and a LearningItem against its linked skill, the same two
  // objects Path Planner and Skills & Learning already render, so the
  // resource shows up on both surfaces immediately, not just inside the
  // roadmap's own collection.
  const addRoadmapResourceToPlan = useCallback((resource: RoadmapResource) => {
    const learningItem: LearningItem = {
      id: makeId("li-roadmap"),
      title: resource.title,
      type: resourceToLearningItemType(resource.type),
      effort: resource.effort,
      skillId: resource.linkedSkillId,
      goalId: resource.linkedGoalId,
      state: "planned",
      expectedBenefit: resource.whatItUnlocks,
    };
    const planItem: PlanItem = {
      id: makeId("plan-roadmap"),
      scenarioId: resource.scenarioId,
      stage: resource.planStage,
      type: resourceToPlanItemType(resource.type),
      title: resource.title,
      detail: resource.whyItMatters,
      state: "accepted",
      linkedSkillId: resource.linkedSkillId,
      linkedGoalId: resource.linkedGoalId,
      linkedLearningItemId: learningItem.id,
    };
    dispatch({ type: "ADD_ROADMAP_RESOURCE_TO_PLAN", resourceId: resource.id, planItem, learningItem });
    toast.success("Added to your plan", {
      description: "Now on your growth plan and in Skills & Learning.",
    });
  }, []);

  const dismissRoadmapResource = useCallback((id: string) => {
    dispatch({ type: "SET_ROADMAP_RESOURCE_STATE", id, state: "dismissed" });
    toast("Not for me", {
      action: {
        label: "Undo",
        onClick: () => dispatch({ type: "SET_ROADMAP_RESOURCE_STATE", id, state: "suggested" }),
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

  const saveRewindCandidate = useCallback(
    (candidateId: string, entry: TrackRecordEntry) => {
      dispatch({ type: "SAVE_REWIND_CANDIDATE", candidateId, entry });
      dispatch({ type: "MARK_REWIND_VIEWED" });
      toast.success("Added to Track Record", {
        description: entry.title,
        action: {
          label: "Open",
          onClick: () => router.push("/track-record"),
        },
      });
    },
    [router]
  );

  const dismissRewindCandidate = useCallback((id: string) => {
    dispatch({ type: "SET_REWIND_CANDIDATE_STATE", id, state: "dismissed" });
    dispatch({ type: "MARK_REWIND_VIEWED" });
    toast("Not this one", {
      action: {
        label: "Undo",
        onClick: () => dispatch({ type: "SET_REWIND_CANDIDATE_STATE", id, state: "pending" }),
      },
    });
  }, []);

  const deferRewindCandidate = useCallback((id: string) => {
    dispatch({ type: "SET_REWIND_CANDIDATE_STATE", id, state: "deferred" });
    dispatch({ type: "MARK_REWIND_VIEWED" });
    toast("Deferred to next week's Rewind", {
      action: {
        label: "Undo",
        onClick: () => dispatch({ type: "SET_REWIND_CANDIDATE_STATE", id, state: "pending" }),
      },
    });
  }, []);

  const resetRewindCandidate = useCallback((id: string) => {
    dispatch({ type: "SET_REWIND_CANDIDATE_STATE", id, state: "pending" });
  }, []);

  const acceptRewindCarryForward = useCallback((id: string) => {
    dispatch({ type: "SET_REWIND_CARRY_FORWARD_STATE", id, state: "accepted" });
    dispatch({ type: "MARK_REWIND_VIEWED" });
    toast.success("Pinned to your attention queue");
  }, []);

  const dismissRewindCarryForward = useCallback((id: string) => {
    dispatch({ type: "SET_REWIND_CARRY_FORWARD_STATE", id, state: "dismissed" });
    dispatch({ type: "MARK_REWIND_VIEWED" });
    toast("Removed from next week's carry-forward", {
      action: {
        label: "Undo",
        onClick: () => dispatch({ type: "SET_REWIND_CARRY_FORWARD_STATE", id, state: "suggested" }),
      },
    });
  }, []);

  // No toast: the card's own save-back confirmation is what Undo reverses.
  const undoRewindCarryForward = useCallback((id: string) => {
    dispatch({ type: "SET_REWIND_CARRY_FORWARD_STATE", id, state: "suggested" });
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
      setComparisonMode,
      setComparisonSelection,
      toggleComparisonSelection,
      focusOpportunityFromComparison,
      undoFocusOpportunityFromComparison,
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
      addRoadmapResourceToPlan,
      dismissRoadmapResource,
      toggleSkillFocus,
      setSkillHighlight,
      clearSkillHighlight,
      setTrackRecordHighlight,
      clearTrackRecordHighlight,
      saveRewindCandidate,
      dismissRewindCandidate,
      deferRewindCandidate,
      resetRewindCandidate,
      acceptRewindCarryForward,
      dismissRewindCarryForward,
      undoRewindCarryForward,
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
      setComparisonMode,
      setComparisonSelection,
      toggleComparisonSelection,
      focusOpportunityFromComparison,
      undoFocusOpportunityFromComparison,
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
      addRoadmapResourceToPlan,
      dismissRoadmapResource,
      toggleSkillFocus,
      setSkillHighlight,
      clearSkillHighlight,
      setTrackRecordHighlight,
      clearTrackRecordHighlight,
      saveRewindCandidate,
      dismissRewindCandidate,
      deferRewindCandidate,
      resetRewindCandidate,
      acceptRewindCarryForward,
      dismissRewindCarryForward,
      undoRewindCarryForward,
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
