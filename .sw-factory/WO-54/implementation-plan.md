# Implementation Plan: WO-54

**Work Order:** WO-54 - Build Help & Support: feedback form and in-product help

## Approach

Four questions and a box.

The questions are the ones this product actually raises rather than a generic
FAQ. An agent that edits your work invites exactly one worry, so the first
answer is about undo, and the fourth answers what running out of Coach turns
costs (nothing, except Coach turns).

**Reports land in the violations table.** That is already where "something
about the Coach was not right" goes, and a report from a person is the highest
quality example of exactly that. A separate table would mean two screens and
one of them forgotten. The rule is `user-report`, so it filters apart.

**A failed report is never confirmed.** The user would wait for a reply nobody
is going to send.
