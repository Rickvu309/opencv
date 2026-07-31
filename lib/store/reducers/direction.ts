// Reducer domain: the DIRECTION nav group (architecture.md section 3) as a
// whole, flow 8: Goal objects, the Path Planner's working scenario and
// PlanItem objects, Roadmap resources, and Skill/LearningItem objects.
// Grouped together because they all feed the same forward-looking growth
// plan and stay in sync (accepting a roadmap resource writes both a
// PlanItem and a LearningItem in one action). Split out of lib/store.tsx's
// single reducer (RDS-981).

import type { StoreState } from "@/lib/store/state";
import type { Action } from "@/lib/store/actions";

type DirectionAction = Extract<
  Action,
  {
    type:
      | "ADD_GOAL"
      | "EDIT_GOAL"
      | "SET_GOAL_STATUS"
      | "ADD_GOAL_PROGRESS_NOTE"
      | "SET_GOAL_HIGHLIGHT"
      | "CLEAR_GOAL_HIGHLIGHT"
      | "UPDATE_TARGET_DIRECTION"
      | "SET_LEARNING_ITEM_STATE"
      | "SET_WORKING_PATH_SCENARIO"
      | "SET_PLAN_ITEM_STATE"
      | "ADD_ROADMAP_RESOURCE_TO_PLAN"
      | "SET_ROADMAP_RESOURCE_STATE"
      | "TOGGLE_SKILL_FOCUS"
      | "SET_SKILL_HIGHLIGHT"
      | "CLEAR_SKILL_HIGHLIGHT";
  }
>;

export function reduceDirection(state: StoreState, action: DirectionAction): StoreState {
  switch (action.type) {
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

    case "ADD_ROADMAP_RESOURCE_TO_PLAN":
      return {
        ...state,
        planItems: [...state.planItems, action.planItem],
        learningItems: [...state.learningItems, action.learningItem],
        roadmapResources: state.roadmapResources.map((resource) =>
          resource.id === action.resourceId ? { ...resource, state: "added" } : resource
        ),
      };

    case "SET_ROADMAP_RESOURCE_STATE":
      return {
        ...state,
        roadmapResources: state.roadmapResources.map((resource) =>
          resource.id === action.id ? { ...resource, state: action.state } : resource
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

    default:
      return state;
  }
}
