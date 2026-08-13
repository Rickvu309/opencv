# Implementation Plan: WO-55

**Work Order:** WO-55 - Add Opening model, lean opening source, and save/remove actions

## Problem

My Applications needs something to be an application *to*. The blueprint's
eventual answer is a live feed; this version deliberately does not build one,
because a scraping pipeline is weeks of work whose failure mode is a stale list
nobody trusts.

## Approach

`lib/search/types.ts`: the `Opening` model, a parser that turns a pasted posting
into one, and four real-shaped seed openings.

The load-bearing decision is that `Opening.requirements` is `Requirement`, the
same type the fit calculator already scores. A requirement line the parser
cannot tie to a skill gets `skills: []`, which the calculator has always treated
as unprovable and left out of the denominator. AC-SEARCH-003.4 therefore falls
out of a decision made long before this feature existed rather than being a
special case written for it.

The parser is best effort and says so. It reads the requirements section when
the posting has one and the bulleted lines when it does not, stops at the
benefits heading, and leaves blank what it cannot work out. Everything it
guesses is editable.

Actions: `opening.add`, `opening.save`, `opening.unsave`, `opening.remove`, all
through the shared dispatch, so save gets its confirmation toast and undo for
free (AC-SEARCH-004.3).

## Decisions worth stating

- **The seed set is seeded into a new account.** That sits close to the
  no-demo-persona rule the seed file is built around, and survives it because
  these are marked `seeded`, render with an "example" badge, and are not
  presented as the user's own. An empty search screen teaches nobody what the
  fit read is for.
- **Deleting an opening deletes its application.** A row that cannot say what
  it is an application to is a puzzle, not a record.
- Migration 011 fills `openings` **empty**, not with the seed. Pushing four
  example postings into the row of somebody who has used the product for a
  month would read as the app inventing jobs they never looked at.
