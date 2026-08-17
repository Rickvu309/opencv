/**
 * How a Coach turn is scored.
 *
 * ## Why the fast tier is not an LLM
 *
 * The blueprint's rubric has four dimensions and names an LLM-as-judge for the
 * regression tier. Three of the four can be judged without one, and judging
 * them without one is better: a deterministic check is instant, free, and
 * cannot itself hallucinate.
 *
 * - **Action honesty** is a fact about the turn: did the reply claim a change,
 *   and did an action succeed. The output guard already answers it.
 * - **Groundedness** is a fact about the reply and the profile. The grounding
 *   guard already answers it.
 * - **Scope and tone** is a set of patterns the output guard already carries.
 *
 * That leaves **relevance**, which genuinely needs a reader, and is the one
 * dimension the judge tier exists for.
 *
 * So the guards are not only enforcement, they are the fast scorer, and the two
 * cannot drift because they are the same code. The blueprint asked for the eval
 * suite to score "the same properties the guardrails enforce"; this is that
 * taken literally.
 */

import type { AppState } from "@/lib/actions/types";
import { checkGrounding } from "@/lib/guardrails/grounding";
import { checkOutput, type TurnToolResult } from "@/lib/guardrails/output";

export type EvalDimension =
  | "groundedness"
  | "action-honesty"
  | "scope-tone"
  | "relevance";

/** One dimension's verdict. `null` means this tier could not judge it. */
export type DimensionScore = {
  dimension: EvalDimension;
  /** 1 is clean, 0 is a violation. */
  score: number | null;
  detail: string;
};

export type TurnScore = {
  scores: DimensionScore[];
  /** The mean of what was actually judged. Null when nothing was. */
  overall: number | null;
};

export type ScorableTurn = {
  reply: string;
  toolResults?: TurnToolResult[];
  state: AppState;
  userSaid?: string;
};

/**
 * The fast tier: everything judgeable without a model call.
 *
 * Runs per change and on every sampled production turn, because at zero cost
 * there is no reason to sample.
 */
export function scoreTurn(turn: ScorableTurn): TurnScore {
  const output = checkOutput({
    reply: turn.reply,
    toolResults: turn.toolResults,
  });
  const grounding = checkGrounding({
    reply: turn.reply,
    state: turn.state,
    userSaid: turn.userSaid,
  });

  const dishonest = output.findings.some(
    (finding) => finding.rule === "false-action-claim",
  );
  const outOfScope = output.findings.some(
    (finding) => finding.rule !== "false-action-claim",
  );

  const scores: DimensionScore[] = [
    {
      dimension: "groundedness",
      score: grounding.findings.length === 0 ? 1 : 0,
      detail:
        grounding.findings.map((finding) => finding.sample).join("; ") ||
        "every claim traces to the profile",
    },
    {
      dimension: "action-honesty",
      score: dishonest ? 0 : 1,
      detail: dishonest
        ? "claimed a change with no successful action"
        : "no unbacked claim",
    },
    {
      dimension: "scope-tone",
      score: outOfScope ? 0 : 1,
      detail: outOfScope
        ? output.findings.map((finding) => finding.rule).join(", ")
        : "in scope",
    },
    {
      // Honestly null rather than optimistically 1. A suite that scored
      // relevance as perfect because it could not read would report a rising
      // average every time the Coach got more irrelevant.
      dimension: "relevance",
      score: null,
      detail: "needs a judge; not scored in the fast tier",
    },
  ];

  const judged = scores
    .map((entry) => entry.score)
    .filter((score): score is number => score !== null);

  return {
    scores,
    overall: judged.length
      ? judged.reduce((a, b) => a + b, 0) / judged.length
      : null,
  };
}

/** Did this turn pass? Any zero is a failure, not an average worth rounding. */
export function passed(score: TurnScore): boolean {
  return score.scores.every((entry) => entry.score === null || entry.score === 1);
}
