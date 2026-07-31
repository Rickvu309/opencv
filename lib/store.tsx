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
import { trackRecordEntries as seedTrackRecordEntries } from "@/lib/data/track-record";
import { goals as seedGoals } from "@/lib/data/goals";
import { skills as seedSkills, learningItems as seedLearningItems } from "@/lib/data/skills";
import { insights as seedInsights } from "@/lib/data/insights";
import { nextActions as seedNextActions } from "@/lib/data/actions";
import { nudges as seedNudges, weeklyReviewScript } from "@/lib/data/nudges";
import { copilotScripts } from "@/lib/data/copilot-scripts";
import type {
  ActivityMoment,
  AiInsight,
  CopilotMessage,
  CvVersion,
  Goal,
  LearningItem,
  NextAction,
  NextActionState,
  Nudge,
  Opportunity,
  OpportunityStatus,
  Priority,
  Profile,
  ProfilePreferences,
  Skill,
  TrackRecordEntry,
  WeeklyReviewScript,
} from "@/lib/types";

export type OpportunitiesView = "board" | "list";

export type OnboardingProfilePatch = Partial<Omit<Profile, "preferences">> & {
  preferences?: Partial<ProfilePreferences>;
};

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
  skills: Skill[];
  learningItems: LearningItem[];
  insights: AiInsight[];
  nextActions: NextAction[];
  nudges: Nudge[];
  weeklyReview: WeeklyReviewScript;
  onboarded: boolean;
  copilot: CopilotState;
  highlightedOpportunityId?: string;
  opportunitiesView: OpportunitiesView;
}

const initialState: StoreState = {
  profile: persona,
  opportunities: seedOpportunities,
  activityMoments: seedActivityMoments,
  cvVersions: seedCvVersions,
  trackRecordEntries: seedTrackRecordEntries,
  goals: seedGoals,
  skills: seedSkills,
  learningItems: seedLearningItems,
  insights: seedInsights,
  nextActions: seedNextActions,
  nudges: seedNudges,
  weeklyReview: weeklyReviewScript,
  onboarded: false,
  copilot: {
    open: false,
    surface: "Home",
    thinking: false,
    messagesBySurface: {},
  },
  highlightedOpportunityId: undefined,
  opportunitiesView: "board",
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
  | { type: "SET_NEXT_ACTION_STATE"; id: string; state: NextActionState }
  | {
      type: "EDIT_NEXT_ACTION";
      id: string;
      patch: Partial<Pick<NextAction, "verb" | "rationale" | "effort" | "dueHint">>;
    }
  | { type: "SET_TRACK_RECORD_STATUS"; id: string; status: "confirmed" | "candidate"; remove?: boolean }
  | { type: "SET_NUDGE_STATE"; id: string; state: Nudge["state"] }
  | {
      type: "SET_TAILORING_SUGGESTION_STATE";
      insightId: string;
      suggestionId: string;
      state: "accepted" | "dismissed";
    }
  | { type: "SET_LEARNING_ITEM_STATE"; id: string; state: LearningItem["state"] }
  | {
      type: "SET_WEEKLY_REVIEW_SUGGESTION_STATE";
      id: string;
      state: "accepted" | "dismissed";
    }
  | { type: "SET_COPILOT_OPEN"; open: boolean }
  | { type: "TOGGLE_COPILOT" }
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

    case "SET_NEXT_ACTION_STATE": {
      const target = state.nextActions.find((nextAction) => nextAction.id === action.id);
      const becameAccepted = action.state === "accepted" && target?.state !== "accepted";
      return {
        ...state,
        nextActions: state.nextActions.map((nextAction) =>
          nextAction.id === action.id ? { ...nextAction, state: action.state } : nextAction
        ),
        activityMoments:
          becameAccepted && target
            ? [
                ...state.activityMoments,
                {
                  id: makeId("activity"),
                  opportunityId: target.opportunityId,
                  kind: "action-accepted",
                  message: `Accepted the next action: ${target.verb}`,
                  createdAt: today(),
                },
              ]
            : state.activityMoments,
      };
    }

    case "EDIT_NEXT_ACTION":
      return {
        ...state,
        nextActions: state.nextActions.map((nextAction) =>
          nextAction.id === action.id ? { ...nextAction, ...action.patch } : nextAction
        ),
      };

    case "SET_TRACK_RECORD_STATUS":
      if (action.remove) {
        return {
          ...state,
          trackRecordEntries: state.trackRecordEntries.filter((entry) => entry.id !== action.id),
        };
      }
      return {
        ...state,
        trackRecordEntries: state.trackRecordEntries.map((entry) =>
          entry.id === action.id ? { ...entry, status: action.status } : entry
        ),
      };

    case "SET_NUDGE_STATE":
      return {
        ...state,
        nudges: state.nudges.map((nudge) =>
          nudge.id === action.id ? { ...nudge, state: action.state } : nudge
        ),
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

    case "SET_LEARNING_ITEM_STATE":
      return {
        ...state,
        learningItems: state.learningItems.map((item) =>
          item.id === action.id ? { ...item, state: action.state } : item
        ),
      };

    case "SET_WEEKLY_REVIEW_SUGGESTION_STATE":
      return {
        ...state,
        weeklyReview: {
          ...state.weeklyReview,
          suggestedFocus: state.weeklyReview.suggestedFocus.map((suggestion) =>
            suggestion.id === action.id ? { ...suggestion, state: action.state } : suggestion
          ),
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
  acceptNextAction: (id: string) => void;
  editNextAction: (
    id: string,
    patch: Partial<Pick<NextAction, "verb" | "rationale" | "effort" | "dueHint">>
  ) => void;
  dismissNextAction: (id: string) => void;
  markNextActionDone: (id: string) => void;
  confirmTrackRecordCandidate: (id: string) => void;
  dismissTrackRecordCandidate: (id: string) => void;
  dismissNudge: (id: string) => void;
  snoozeNudge: (id: string) => void;
  acceptTailoringSuggestion: (insightId: string, suggestionId: string) => void;
  dismissTailoringSuggestion: (insightId: string, suggestionId: string) => void;
  acceptLearningItem: (id: string) => void;
  dismissLearningItem: (id: string) => void;
  acceptWeeklyReviewSuggestion: (id: string) => void;
  dismissWeeklyReviewSuggestion: (id: string) => void;
  setCopilotOpen: (open: boolean) => void;
  toggleCopilot: () => void;
  setCopilotSurface: (surface: string, objectLabel?: string) => void;
  sendCopilotMessage: (text: string) => void;
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
    toast("Next action dismissed");
  }, []);

  const markNextActionDone = useCallback((id: string) => {
    dispatch({ type: "SET_NEXT_ACTION_STATE", id, state: "done" });
    toast.success("Next action marked done");
  }, []);

  const confirmTrackRecordCandidate = useCallback((id: string) => {
    dispatch({ type: "SET_TRACK_RECORD_STATUS", id, status: "confirmed" });
    toast.success("Added to Track Record");
  }, []);

  const dismissTrackRecordCandidate = useCallback((id: string) => {
    dispatch({ type: "SET_TRACK_RECORD_STATUS", id, status: "candidate", remove: true });
    toast("Candidate dismissed");
  }, []);

  const dismissNudge = useCallback((id: string) => {
    dispatch({ type: "SET_NUDGE_STATE", id, state: "dismissed" });
    toast("Nudge dismissed");
  }, []);

  const snoozeNudge = useCallback((id: string) => {
    dispatch({ type: "SET_NUDGE_STATE", id, state: "snoozed" });
    toast("Nudge snoozed for later");
  }, []);

  const acceptTailoringSuggestion = useCallback((insightId: string, suggestionId: string) => {
    dispatch({ type: "SET_TAILORING_SUGGESTION_STATE", insightId, suggestionId, state: "accepted" });
    toast.success("Suggestion accepted");
  }, []);

  const dismissTailoringSuggestion = useCallback((insightId: string, suggestionId: string) => {
    dispatch({ type: "SET_TAILORING_SUGGESTION_STATE", insightId, suggestionId, state: "dismissed" });
    toast("Suggestion dismissed");
  }, []);

  const acceptLearningItem = useCallback((id: string) => {
    dispatch({ type: "SET_LEARNING_ITEM_STATE", id, state: "planned" });
    toast.success("Added to your learning plan");
  }, []);

  const dismissLearningItem = useCallback((id: string) => {
    dispatch({ type: "SET_LEARNING_ITEM_STATE", id, state: "dismissed" });
    toast("Learning item dismissed");
  }, []);

  const acceptWeeklyReviewSuggestion = useCallback((id: string) => {
    dispatch({ type: "SET_WEEKLY_REVIEW_SUGGESTION_STATE", id, state: "accepted" });
    toast.success("Suggestion accepted");
  }, []);

  const dismissWeeklyReviewSuggestion = useCallback((id: string) => {
    dispatch({ type: "SET_WEEKLY_REVIEW_SUGGESTION_STATE", id, state: "dismissed" });
    toast("Suggestion dismissed");
  }, []);

  const setCopilotOpen = useCallback((open: boolean) => dispatch({ type: "SET_COPILOT_OPEN", open }), []);
  const toggleCopilot = useCallback(() => dispatch({ type: "TOGGLE_COPILOT" }), []);

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
      const responseText =
        matchedExchange?.response ??
        "Noted. That's outside what's scripted for this prototype, try one of the suggested prompts above for the full response.";

      const delay = 600 + Math.random() * 600;
      if (thinkingTimeout.current) clearTimeout(thinkingTimeout.current);
      thinkingTimeout.current = setTimeout(() => {
        const copilotMessage: CopilotMessage = {
          id: makeId("msg"),
          role: "copilot",
          text: responseText,
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
      acceptNextAction,
      editNextAction,
      dismissNextAction,
      markNextActionDone,
      confirmTrackRecordCandidate,
      dismissTrackRecordCandidate,
      dismissNudge,
      snoozeNudge,
      acceptTailoringSuggestion,
      dismissTailoringSuggestion,
      acceptLearningItem,
      dismissLearningItem,
      acceptWeeklyReviewSuggestion,
      dismissWeeklyReviewSuggestion,
      setCopilotOpen,
      toggleCopilot,
      setCopilotSurface,
      sendCopilotMessage,
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
      acceptNextAction,
      editNextAction,
      dismissNextAction,
      markNextActionDone,
      confirmTrackRecordCandidate,
      dismissTrackRecordCandidate,
      dismissNudge,
      snoozeNudge,
      acceptTailoringSuggestion,
      dismissTailoringSuggestion,
      acceptLearningItem,
      dismissLearningItem,
      acceptWeeklyReviewSuggestion,
      dismissWeeklyReviewSuggestion,
      setCopilotOpen,
      toggleCopilot,
      setCopilotSurface,
      sendCopilotMessage,
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
