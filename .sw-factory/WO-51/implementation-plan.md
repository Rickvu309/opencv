# Implementation Plan: WO-51

**Work Order:** WO-51 - Build feature flags and experiment assignment on the Vercel Flags SDK

## Approach

Two files: `lib/flags/assign.ts` (pure) and `lib/flags/flags.ts` (the SDK).

**Stable assignment without a table.** The obvious implementation of "an
experience stays stable per user" is a row per user per experiment, and it is
the wrong one: it puts a write on every flag read and makes "what did this user
see" losable. A hash of the experiment key and the subject gives the same
answer forever, on any machine, from the ids alone. Recording the assignment is
then for attribution, not for correctness.

**The experiment key is in the hash.** Without it, a user in the top decile
would land in the same bucket of every experiment at once, and two experiments
running together would be measuring each other.

**An anonymous visitor gets the control**, never a coin toss. A session that
reshuffled per request would be an experiment measuring nothing.

**What the flags control** is deliberately the two hooks Phase 3 already
exposed, the router's policy and the guards' strictness, rather than anything
new. Those were built as parameters so this work order would have somewhere to
attach; attaching to them is the test of whether that was real.

**Guardrail strictness is a flag but not an experiment.** Splitting traffic on a
safety layer would mean deciding by coin toss which users are protected.
