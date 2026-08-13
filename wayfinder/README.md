# Wayfinder, the record of finished efforts

**Live work is in GitHub Issues**, not here. This repo adopted GitHub as its tracker on
2026-08-05; the conventions, including how wayfinder expresses maps, blocking and the
frontier, are in `docs/agents/issue-tracker.md`.

This directory is what remains: **completed and archived efforts, kept as a record.**
Nothing queries their frontier, so files are the right shape for them, and their
resolution notes are the reasoning later efforts cite.

## Layout

One directory per effort, each holding its own map and tickets.

**Active**, in the tracker

None currently. Building against the production-level map's decisions is the next effort,
not yet charted.

**Complete**, destination reached and every ticket closed.

- `backend/`, [Map, OpenPath backend on Eve](backend/map.md).
- `launch/`, [Map, OpenPath landing and the waiting list](launch/map.md).
- [Map, OpenPath at production level](https://github.com/quanvu309/openpath/issues/12),
  GitHub issue #12. Twenty decisions covering copy, screens, flows, motion, backend shape,
  verification, architecture, and obligations, scoped to fifty invited users on
  15/09/2026. Absorbed [Map, OpenPath without mock data](real-data.md). **Decided solo,
  per explicit instruction, without live grilling — unreviewed by the person the map was
  for. Read before building against it.**

**Archived**, under `archive/`. An effort is archived when it stops being worked, whether or
not its destination was reached; a map archived with tickets still open records what was left
under an **Unfinished at archive** section. Reviving one means moving the directory back out.

- `archive/ui-ux/`, [Map, OpenPath at a production UI/UX bar](archive/ui-ux/map.md).

Within an effort:

- `map.md`, the map (`wayfinder:map`). The index: destination, notes, decisions made, fog, out of scope.
- `tickets/NN-slug.md`; one child ticket per file. The filename number is its id; the `#` heading is its **name**.

Ticket numbers are unique within an effort, not across them. Refer to a map or ticket by its
**name**, never by a bare number.

## Ticket header fields

Every ticket opens with:

| Field | Meaning |
| --- | --- |
| `Type` | `wayfinder:research` / `prototype` / `grilling` / `task` |
| `Status` | `open` or `closed` |
| `Assignee` | the claim. `—` means unclaimed |
| `Blocked by` | names of tickets that must close first. `—` means unblocked |

## Operations

**Claim**, set `Assignee` to the dev driving the map *before* any work, so concurrent sessions skip it.

**Frontier**, open, unblocked, unclaimed tickets. Only meaningful for an effort still kept
as files; live efforts use GitHub's own blocker rendering. Point it at one effort's `tickets/`:

```bash
grep -l "Status:.*open" wayfinder/backend/tickets/*.md \
  | xargs grep -l "Assignee:.*—" \
  | xargs grep -L "Blocked by:.*\[" 
```

**Resolve**, append a `## Resolution` section to the ticket, set `Status: closed`, add a one-line gist plus link to **Decisions so far** in `map.md`, then **clear the `Blocked by` line of every ticket this one blocked**, leaving the closed blocker's name in prose.

That last step is bookkeeping the frontier query cannot do for itself: grep sees a `Blocked by` link but cannot follow it to check whether that ticket is closed. Skip it and a takeable ticket stays invisible.

Markdown has no native blocking, so `Blocked by` is the body convention that stands in for it.
