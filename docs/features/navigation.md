# Navigation

**Track:** Commodity. Chat surface rail cloned from [Beautiful UI Sidebar Nav](https://www.beautifului.dev/) (hover pill, accent new), [Onyx SidebarTab](https://onyx-storybook.vercel.app/), plus [assistant-ui ThreadList](https://www.assistant-ui.com/docs/ui/thread-list) (new, history, rename, delete, date groups). Destination groups cloned from Linear (short labelled sections, not eight peers). Skin from [design.md](../design.md): accent only on the create action and interactive fills, 44px targets, no badges or streaks.

**Job:** in a short anxious session, get back to the conversation or the one artifact they came for, without hunting. The map of places and the four channels that move between them live in [flows.md](../flows.md); this spec is the shell.

## Concept

The signed-in shell is a rail (or a drawer on a phone), a main column, a header bell, and a Coach dock that travels except on Coach. Groups are labels. Coach is home, named next to the mark. Proof is not a rail row. The word Applications does not appear; the tracker is **Apply**.

There is no `navigation` feature module and no navigation tables. Threads use `conversation.*`. Account uses profile and auth. Movement the Coach initiates uses `app.open`, defined here and listed on [coach.md](coach.md).

## Screens

The shell wraps every signed-in route except `/onboarding`.

### Regions

Every signed-in screen is four layers — main, chrome (rail plus header bell), dock, overlays — with reading order and yield rules defined in [layout.md](../design-system/layout.md). This spec owns the chrome layer; the main column belongs to each place's layout type.

### Desktop rail, top to bottom

1. Mark + OpenPath and Hide
2. Coach (icon+label row, same as Paper)
3. Prepare (Paper, Pitch) and Opportunities (Search, Apply)
4. History (collapsible, directly under Apply). The label stays even when there are no threads yet; threads appear here after the first send.
5. Account at the bottom edge

Only places are rows. CV / Resume and Letter are not rail rows; they are the type filter on `/paper`. Proof is not a rail row; it is opened from Paper, a Coach card, or a URL. `/proof` marks Paper.

Active state: ink weight 590 on the current place, same row style as the rest. Coach marks `/coach`. `/paper/$paperId` and `/proof` mark Paper. `/applications` marks Apply.

Desktop rail defaults to 16rem and stays until 768px, where it becomes the drawer. On desktop the trailing edge is a splitter: drag to 12–20rem, arrow keys nudge 8px (Shift 32px), double-click resets to 16rem. The chosen width persists locally. The drawer stays 16rem. Dock on desktop is 20rem by at most 32rem, bottom-right, so it never covers the band. On a phone the dock is a bottom sheet at 70vh.

`/coach`: the conversation owns the main column. No second copy of the thread list. No dock. The active thread is `/coach?thread=<id>`.

Artifact screens (Paper, Proof, Pitch, Search, Apply, Profile, Settings): main column is the artifact. Coach dock travels. Bell stays in the header.

### Mobile

ChatGPT pattern, not bottom tabs (tabs would make Coach one of six equals). Full-screen destination; a drawer holds the same rail logic (Coach, New conversation, History, Prepare, Opportunities, Account). Dock is a sheet on artifact screens. Touch 44px. `prefers-reduced-motion` on drawer and dock.

### Out of the shell

Landing, auth, onboarding, `/p/$slug`, `/u/$handle`: no rail, no dock, no bell.

## Channels this spec owns

See [flows.md](../flows.md) for the full channel contract. This spec implements:

- **C1** — the rail and drawer.
- **C2** — `app.open` destination vocabulary and dock behaviour.
- **C4** — cold-entry: gates, parent marking, honest not-found.

C3 (place-to-place hand-offs) is owned by the feature that starts the hand-off; this spec only requires that Back returns to the origin.

### `app.open`

| Command | Agent | What |
|---|---|---|
| `app.open` | yes | Open a place or artifact the user asked to see. Input is a typed destination, never a raw URL. `inverse: null`. |

Allowed destinations: Chat, Paper (optionally a `paperId`), Proof (optionally a `proofId`), Pitch, Search (no id — an opening's detail is in-page state; for a saved opening the Coach opens its Apply row instead), Apply (optionally an application id), Profile, Settings. Forbidden: auth pages, landing, onboarding, another user's `/p/$slug` or `/u/$handle`.

The UI has the same destinations as links, so the agent cannot go somewhere the user cannot. The dock stays; the screen behind it changes. Never called unasked; a command that creates an artifact yields a card, not `app.open`.

## States

| State | Behaviour |
|---|---|
| No threads yet | Coach stays; History shows the label only; starters live on `/coach` |
| Long thread title | Truncate; full title on hover or long-press, never wrap the rail |
| Vietnamese account name | Must not clip stacked tone marks; test with "Nguyễn Thị Ngọc Ánh" |
| Dock closed | A compact control to reopen; does not cover the artifact's primary action |
| Dock open | Same conversation as `/coach`; composer usable; artifact still operable |
| Drawer open | Same items as the desktop rail; focus trap; Esc and the scrim close it |
| Onboarding | No rail. Completing it lands on `/coach` |
| Unsigned hitting a signed-in URL | Redirect to `/sign-in` |
| Onboarding incomplete | Redirect to `/onboarding` except that route itself |
| Missing or foreign id | Honest not-found, one next step (back to the list). Never a blank screen |
| Offline Coach | Dock still opens; copy from [coach.md](coach.md). The rest of the shell works |
| Notification empty | Bell opens; "No notifications yet." |

## Empty state

The rail is never empty once signed in: Coach, Prepare, Opportunities, and History are always there. Empty states inside a place belong to that feature.

## Out of scope

Command palette, customizable order, unread badges on nav, gamified streaks, Proof as a root-rail peer, Prepare or Opportunities as screens, putting Profile or Settings in the core rail, the word Applications in the UI, a `navigation` feature module. Rail *width* is resizable; item order is not.
