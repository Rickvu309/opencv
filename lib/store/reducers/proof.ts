// Reducer domain: the Proof Builder (/proof, RDS-987). Accept is one
// compound action, the same "provider builds the real objects, reducer only
// applies them" pattern CREATE_TAILORED_CV_VERSION and APPLY_STRATEGY_MOVE
// already use: the transformation's own saveBackUndo is stored on the
// transformation itself (mirroring AiSignal's appliedActivityMomentId) so
// Undo can fully reverse the save-back even after a remount. Split out as
// its own domain file since it writes across 4 different real surfaces (CV
// sections, the profile, an opportunity's Materials, the growth plan)
// rather than owning one slice the way the other domain reducers do.

import { today } from "@/lib/store/helpers";
import type { StoreState } from "@/lib/store/state";
import type { Action } from "@/lib/store/actions";

type ProofAction = Extract<
  Action,
  {
    type: "SET_PROOF_TRANSFORMATION_STATE" | "ACCEPT_PROOF_TRANSFORMATION" | "UNDO_PROOF_TRANSFORMATION";
  }
>;

export function reduceProof(state: StoreState, action: ProofAction): StoreState {
  switch (action.type) {
    case "SET_PROOF_TRANSFORMATION_STATE":
      return {
        ...state,
        proofTransformations: state.proofTransformations.map((transformation) =>
          transformation.id === action.id ? { ...transformation, state: action.state } : transformation
        ),
      };

    case "ACCEPT_PROOF_TRANSFORMATION": {
      const transformation = state.proofTransformations.find((entry) => entry.id === action.id);
      if (!transformation) return state;
      const target = transformation.target;
      const addedNote = action.addedNote;
      const addedPlanItem = action.addedPlanItem;

      let cvVersions = state.cvVersions;
      let profile = state.profile;
      let opportunities = state.opportunities;
      let planItems = state.planItems;
      let activityMoments = state.activityMoments;

      if (target.kind === "cv-section") {
        cvVersions = state.cvVersions.map((cv) =>
          cv.id === target.cvId
            ? {
                ...cv,
                lastEditedAt: today(),
                sections: cv.sections.map((section) =>
                  section.id === target.sectionId ? { ...section, content: action.groundedProof } : section
                ),
              }
            : cv
        );
      } else if (target.kind === "profile-summary") {
        profile = { ...profile, summary: action.groundedProof };
      } else if (target.kind === "profile-strength") {
        const exists = profile.strengthEvidence.some((item) => item.strength === target.strength);
        const backingEntryId = transformation.backingEntryIds[0];
        profile = {
          ...profile,
          strengthEvidence: exists
            ? profile.strengthEvidence.map((item) =>
                item.strength === target.strength
                  ? { ...item, note: action.groundedProof, trackRecordEntryId: backingEntryId }
                  : item
              )
            : [
                ...profile.strengthEvidence,
                { strength: target.strength, note: action.groundedProof, trackRecordEntryId: backingEntryId },
              ],
        };
      } else if (target.kind === "opportunity-positioning" && addedNote) {
        opportunities = state.opportunities.map((opportunity) =>
          opportunity.id === target.opportunityId
            ? { ...opportunity, positioningNotes: [...(opportunity.positioningNotes ?? []), addedNote] }
            : opportunity
        );
      } else if (target.kind === "path-plan-item" && addedPlanItem) {
        planItems = [...state.planItems, addedPlanItem];
      }

      if (action.activityMoment) {
        activityMoments = [...state.activityMoments, action.activityMoment];
      }

      return {
        ...state,
        cvVersions,
        profile,
        opportunities,
        planItems,
        activityMoments,
        proofTransformations: state.proofTransformations.map((entry) =>
          entry.id === action.id
            ? { ...entry, state: "accepted", groundedProof: action.groundedProof, saveBackUndo: action.saveBackUndo }
            : entry
        ),
      };
    }

    case "UNDO_PROOF_TRANSFORMATION": {
      const transformation = state.proofTransformations.find((entry) => entry.id === action.id);
      const undo = transformation?.saveBackUndo;
      if (!transformation || !undo) return state;

      let cvVersions = state.cvVersions;
      let profile = state.profile;
      let opportunities = state.opportunities;
      let planItems = state.planItems;
      let activityMoments = state.activityMoments;

      if (undo.kind === "cv-section") {
        cvVersions = state.cvVersions.map((cv) =>
          cv.id === undo.cvId
            ? {
                ...cv,
                sections: cv.sections.map((section) =>
                  section.id === undo.sectionId ? { ...section, content: undo.previousContent } : section
                ),
              }
            : cv
        );
        if (undo.activityMomentId) {
          activityMoments = activityMoments.filter((moment) => moment.id !== undo.activityMomentId);
        }
      } else if (undo.kind === "profile-summary") {
        profile = { ...profile, summary: undo.previousSummary };
      } else if (undo.kind === "profile-strength") {
        const previousEvidence = undo.previousEvidence;
        profile = {
          ...profile,
          strengthEvidence: previousEvidence
            ? profile.strengthEvidence.map((item) => (item.strength === undo.strength ? previousEvidence : item))
            : profile.strengthEvidence.filter((item) => item.strength !== undo.strength),
        };
      } else if (undo.kind === "opportunity-positioning") {
        opportunities = state.opportunities.map((opportunity) =>
          opportunity.id === undo.opportunityId
            ? {
                ...opportunity,
                positioningNotes: (opportunity.positioningNotes ?? []).filter((note) => note.id !== undo.noteId),
              }
            : opportunity
        );
        if (undo.activityMomentId) {
          activityMoments = activityMoments.filter((moment) => moment.id !== undo.activityMomentId);
        }
      } else if (undo.kind === "path-plan-item") {
        planItems = state.planItems.filter((item) => item.id !== undo.planItemId);
      }

      return {
        ...state,
        cvVersions,
        profile,
        opportunities,
        planItems,
        activityMoments,
        proofTransformations: state.proofTransformations.map((entry) =>
          entry.id === action.id ? { ...entry, state: "proposed", saveBackUndo: undefined } : entry
        ),
      };
    }

    default:
      return state;
  }
}
