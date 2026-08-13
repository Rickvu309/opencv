/**
 * The flags this product actually has.
 *
 * Built on the Vercel Flags SDK, which is what the blueprint specifies. The SDK
 * owns evaluation, deduplication within a request, and the Toolbar integration;
 * what this file owns is the list, and `identify` and `decide` for each.
 *
 * ## Server-side only, on purpose
 *
 * `flag()` evaluates on the server. Nothing here is shipped to the browser, so
 * a rollout percentage is not something a reader can inspect and a variant is
 * not something a client can ask for. The blueprint's "evaluated server-side"
 * contract is the SDK's default rather than something this has to enforce.
 *
 * ## What the flags control
 *
 * Deliberately the two hooks the AI stack already exposed rather than anything
 * new: the router's policy and the guards' strictness. Both were built as
 * parameters in Phase 3 precisely so this work order would have somewhere to
 * attach, and attaching to them is the whole test of whether that was real.
 */

import { flag } from "flags/next";

import type { RoutingPolicy } from "@/lib/ai/router";
import { currentAccount } from "@/lib/auth/dal";
import type { Strictness } from "@/lib/guardrails/config";
import { assign, inRollout, type Experiment } from "@/lib/flags/assign";

/**
 * Who is asking.
 *
 * The account id when there is one, so the assignment follows the person
 * between their laptop and their phone. Null otherwise, which every consumer
 * treats as "give them the control".
 */
type Subject = { accountId: string | null };

const identify = async (): Promise<Subject> => {
  try {
    const account = await currentAccount();
    return { accountId: account?.id ?? null };
  } catch {
    // A flag must never be the reason a page fails. An unreachable session
    // store means an anonymous subject, which means the control.
    return { accountId: null };
  }
};

/**
 * Which model policy a session routes under.
 *
 * The experiment the gateway was built for: `preferred` is the declared order,
 * `cheapest` routes by cost. Running them against each other on live traffic is
 * how the routing policy gets decided by measurement rather than by argument.
 */
export const MODEL_POLICY_EXPERIMENT: Experiment = {
  key: "model-routing-policy",
  variants: [
    // Weighted heavily toward the control. An experiment that puts half the
    // users on the untested arm is not an experiment, it is a deploy.
    { name: "preferred", weight: 9 },
    { name: "cheapest", weight: 1 },
  ],
};

export const modelRoutingPolicy = flag<RoutingPolicy, Subject>({
  key: "model-routing-policy",
  description: "Which policy the model router uses to pick a model.",
  defaultValue: "preferred",
  options: [{ value: "preferred" }, { value: "cheapest" }, { value: "fastest" }],
  identify,
  decide: ({ entities }) =>
    assign(MODEL_POLICY_EXPERIMENT, entities?.accountId ?? null) as RoutingPolicy,
});

/**
 * How hard the guards come down.
 *
 * A flag rather than only an environment variable because the blueprint asks
 * for strictness to be variable for rollout, and because an incident wants a
 * dial that does not need a deploy.
 */
export const guardrailStrictness = flag<Strictness, Subject>({
  key: "guardrail-strictness",
  description: "How strictly the input and output guards are applied.",
  defaultValue: "standard",
  options: [{ value: "off" }, { value: "standard" }, { value: "strict" }],
  identify,
  // Not an experiment: every user gets the configured strictness. Splitting
  // traffic on a safety layer would mean deciding, by coin toss, which users
  // are protected.
  decide: () => (process.env.OPENPATH_GUARDRAILS as Strictness) ?? "standard",
});

/**
 * The trace sink, behind a percentage.
 *
 * The first thing worth shipping dark: tracing costs a write per turn, and the
 * honest way to find out what that costs is to turn it on for a tenth of
 * accounts and look.
 */
export const traceTurns = flag<boolean, Subject>({
  key: "trace-turns",
  description: "Record a trace for each Coach turn.",
  defaultValue: true,
  identify,
  decide: ({ entities }) => {
    const percent = Number(process.env.OPENPATH_TRACE_PERCENT ?? "100");
    return inRollout("trace-turns", entities?.accountId ?? null, percent);
  },
});

/** Every flag, for the Toolbar's discovery endpoint. */
export const allFlags = {
  modelRoutingPolicy,
  guardrailStrictness,
  traceTurns,
};
