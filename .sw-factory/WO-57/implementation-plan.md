# Implementation Plan: WO-57

**Work Order:** WO-57 - Build the Search view UI

## Approach

`app/(app)/search/page.tsx`. Ranked list from WO-56, a search field over title,
company and description, three filters (all, saved, examples), and a paste box.

Every card leads with met-versus-total. Expanding one shows three lists: what
the profile has, what is missing, and what is not scoreable, each named rather
than counted, because AC-SEARCH-003.3 asks for the specific gap.

Two empty states, saying different things: an empty profile is told to add
facts, and an empty opening list is told what to paste. They are different
problems and one message for both would be useless for either.
