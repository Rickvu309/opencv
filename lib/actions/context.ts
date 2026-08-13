import { actionNames } from "./registry";
import type { AppState } from "./types";

/**
 * What the Coach is allowed to see, and the one place that decides it.
 *
 * ## Why this lives here and not in `agent/lib/`
 *
 * `agent-native.md` §6.1 put this seam on the agent side, behind read tools
 * (`get_profile`, `get_plan`, `get_paths`) that read `lib/data.ts`. That was
 * right when the app had one fixed mock, and it is wrong now.
 *
 * The agent runs on the server. The user's state lives in a React store in the
 * browser and is never written anywhere the server can reach. So a server-side
 * read tool would return the *seed*, not the user. It would tell the Coach the
 * target role is whatever `seed.ts` says while the user is looking at a screen
 * that says otherwise, and the Coach would cite it with confidence. That is
 * worse than having no read path at all: `agent/instructions.md` rule 1 is
 * "bằng chứng trước lời khuyên", and stale evidence still reads as evidence.
 *
 * So this phase the state travels *to* the agent, on the turn, from the side
 * that actually has it. Read tools become the right answer the moment there is
 * a datastore both sides can see, which is the next ticket. When that lands,
 * this module is what the tools call, and no caller changes.
 *
 * ## Why the whole state
 *
 * Measured: 4910 bytes serialized, roughly 1.3k tokens, against a 120k
 * per-session input cap. A curated projection would save little and would drift
 * from the real shape the moment an action is added. Slice it if it passes
 * ~10KB, and slice by measuring rather than by guessing which fields matter.
 *
 * Ids are kept deliberately. The Coach needs a todo's id to toggle it and a
 * node's id to target it; a projection that dropped them would let the Coach
 * describe changes it cannot make.
 */
export function coachContext(state: AppState, route: string) {
  return {
    // Where the user is standing. The Coach should answer "what do I do on
    // this screen" differently on /todo than on /career-map.
    route,
    // The catalog is in the tool description too, but naming it here lets the
    // Coach reason about what it *could* do before deciding to do it.
    availableActions: actionNames,
    state,
  };
}

export type CoachContext = ReturnType<typeof coachContext>;
