// Reducer domain: CvVersion objects (flow 6, /cvs) and the tailoring
// suggestion state that lives on an AiInsight of kind "tailoring". Split
// out of lib/store.tsx's single reducer (RDS-981).

import { today } from "@/lib/store/helpers";
import type { StoreState } from "@/lib/store/state";
import type { Action } from "@/lib/store/actions";

type CvsAction = Extract<
  Action,
  {
    type:
      | "SET_TAILORING_SUGGESTION_STATE"
      | "ADD_CV_VERSION"
      | "DELETE_CV_VERSION"
      | "SET_CV_SECTION_CONTENT"
      | "SET_CV_OPPORTUNITY_LINK"
      | "CREATE_TAILORED_CV_VERSION";
  }
>;

export function reduceCvs(state: StoreState, action: CvsAction): StoreState {
  switch (action.type) {
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

    default:
      return state;
  }
}
