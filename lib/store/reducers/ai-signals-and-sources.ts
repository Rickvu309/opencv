// Reducer domain: the embedded AI signal pattern (components/ai/, section 7
// form 1) and connected sources / the synced-context inbox (/sources).
// Grouped together because both write grounded, evidence-backed proposals
// into the same shape (approve/dismiss/undo). Split out of lib/store.tsx's
// single reducer (RDS-981).

import { buildSignalActivityMessage } from "@/lib/ai-signal-utils";
import { buildInboxTrackRecordCandidate, evidenceTitle } from "@/lib/inbox-utils";
import { makeId, today } from "@/lib/store/helpers";
import type { StoreState } from "@/lib/store/state";
import type { Action } from "@/lib/store/actions";
import type { AiSignal, InboxItemLink } from "@/lib/types";

type AiSignalsAndSourcesAction = Extract<
  Action,
  {
    type:
      | "APPROVE_AI_SIGNAL"
      | "UNDO_AI_SIGNAL"
      | "DISMISS_AI_SIGNAL"
      | "UNDISMISS_AI_SIGNAL"
      | "CONNECT_SOURCE"
      | "LINK_INBOX_ITEM"
      | "UNDO_LINK_INBOX_ITEM"
      | "DISMISS_INBOX_ITEM"
      | "UNDO_DISMISS_INBOX_ITEM";
  }
>;

export function reduceAiSignalsAndSources(state: StoreState, action: AiSignalsAndSourcesAction): StoreState {
  switch (action.type) {
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

    default:
      return state;
  }
}
