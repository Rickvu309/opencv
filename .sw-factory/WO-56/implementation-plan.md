# Implementation Plan: WO-56

**Work Order:** WO-56 - Rank openings and show fit and gap using Fit Scoring

## Problem

Point the existing calculator at real postings. WO-56 forbids new scoring
logic, and AC-SEARCH-003.2 forbids showing a number not derived from the
requirements. Those two together decide the whole design.

## Approach

`lib/search/fit.ts` reuses `fitFor` unchanged: same evidence extraction, same
accent-insensitive matching, same unprovable handling. What it does not reuse is
the *score*, which blends 65% evidence with 35% readiness. An opening's fit is
met over total and nothing else.

That is not a change to the calculation, it is a change to what is shown, and
the requirement is explicit about it. A student looking at a real posting
deserves to know they meet three of its five requirements, not that an opaque
number says 62.

## Decisions worth stating

- **An opening naming no readable requirement ranks last.** Zero over zero is
  an absence of information, not a perfect match, and sorting it to the top
  would put the least informative postings in front of the user.
- **`hasProfileFacts` gates the ranking.** Ranking an empty profile produces a
  list where everything scores zero, ordered by nothing; presenting that as
  "openings matched to your profile" is the quiet dishonesty this product
  exists not to do (AC-SEARCH-001.2).
