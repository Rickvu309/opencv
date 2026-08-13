# Implementation Plan: WO-52

**Work Order:** WO-52 - Build the tiered evaluation suite and drift alerting

## Approach

**The fast tier is not an LLM, and that is the interesting decision.** The
blueprint's rubric has four dimensions; three of them are facts the guards
already establish. Action honesty is "did the reply claim a change and did one
succeed". Groundedness is "does this claim appear in the profile". Scope and
tone is a pattern set. All three are answered by `checkOutput` and
`checkGrounding`, instantly, for free, and without a judge that can itself
hallucinate.

So the guards are the fast scorer. The blueprint asked for the eval suite to
score "the same properties the guardrails enforce", and this is that taken
literally: the two cannot drift because they are the same code.

**Relevance scores `null`, not 1.** It genuinely needs a reader. A suite that
scored it as perfect because it could not judge would report a rising average
every time the Coach got more irrelevant.

**Any zero fails the turn.** Three clean dimensions and one violation is not a
75% pass; the violation is the thing that happened.

## Drift

Compared against the previous window rather than a threshold, because nobody
knows what a normal undo rate is before launch. Whatever it is, a jump from it
is worth looking at.

Three outcomes, not two: "not enough data to say" is a different answer from
"fine", and reporting the first as the second is how a quiet week gets mistaken
for a healthy one. A relative rise needs an absolute floor too, or 1% to 2% is
a 100% increase and an alert nobody should be woken for.

The sweep reads the acceptance signal rather than re-scoring replies, because
the traces do not store reply text and should not: keeping every Coach reply
for a fortnight to grade later is a privacy cost nobody has been asked to pay.

A drift finding lands in the violations table, so one screen answers "is the
Coach all right" rather than two.
