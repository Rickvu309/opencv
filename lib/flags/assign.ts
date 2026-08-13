/**
 * Which variant this person gets, and why it never changes on them.
 *
 * ## Stable assignment, without a table
 *
 * The blueprint's requirement is that an experience stays stable per user. The
 * obvious implementation is a row per user per experiment, and it is the wrong
 * one here: it puts a database write on the path of every flag read, and it
 * makes "what did this user see" a thing that can be lost.
 *
 * A hash does the same job with no state. The same user and the same experiment
 * always produce the same number, so the assignment is reproducible from the
 * ids alone, on any machine, forever. Recording it (which the sink does) is
 * then for attribution rather than for correctness.
 *
 * Pure and synchronous, so the router and the guards can ask it without
 * becoming async, and so it can be tested exhaustively.
 */

import { createHash } from "node:crypto";

/** A variant of an experiment: a name and the share of traffic it takes. */
export type Variant = {
  name: string;
  /** Relative weight. Two variants at 1 each is a 50/50 split. */
  weight: number;
};

export type Experiment = {
  key: string;
  variants: Variant[];
};

/**
 * A number in [0, 1) that is the same every time for this pair.
 *
 * The experiment key is part of the hash on purpose: without it, a user in the
 * top decile would land in the same bucket of every experiment at once, and two
 * experiments running together would be measuring each other.
 */
export function bucket(experimentKey: string, subject: string): number {
  const digest = createHash("sha256")
    .update(`${experimentKey}:${subject}`)
    .digest();
  // 32 bits is more resolution than any traffic split needs, and stays well
  // inside an exact double.
  return digest.readUInt32BE(0) / 0x1_0000_0000;
}

/**
 * The variant for this subject.
 *
 * A subject with no id (a signed-out visitor) gets the first variant rather
 * than a random one: an anonymous session that reshuffled on every request
 * would be an experiment measuring nothing, and the control is the honest
 * default.
 */
export function assign(experiment: Experiment, subject: string | null): string {
  const [first] = experiment.variants;
  if (!first) throw new Error(`experiment ${experiment.key} has no variants`);
  if (!subject) return first.name;

  const total = experiment.variants.reduce((sum, v) => sum + v.weight, 0);
  if (total <= 0) return first.name;

  let at = bucket(experiment.key, subject) * total;
  for (const variant of experiment.variants) {
    at -= variant.weight;
    if (at < 0) return variant.name;
  }
  // Only reachable through floating-point drift at the very top of the range.
  return experiment.variants[experiment.variants.length - 1].name;
}

/**
 * Is this subject inside a percentage rollout?
 *
 * The other half of shipping dark: a flag that is on for 10% of people has to
 * be on for the *same* 10% tomorrow, or the feature flickers for everybody.
 */
export function inRollout(
  flagKey: string,
  subject: string | null,
  percent: number,
): boolean {
  if (percent >= 100) return true;
  if (percent <= 0) return false;
  if (!subject) return false;
  return bucket(flagKey, subject) * 100 < percent;
}
