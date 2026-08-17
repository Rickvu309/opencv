# Navigation

**Track:** Commodity. Chat surface rail cloned from ChatGPT / Claude (new chat, thread history, rename, delete, account at the edge). Destination groups cloned from Linear (short labelled sections, not eight peers). Skin from [design.md](../design.md): accent only on active, 44px targets, no badges or streaks.

**Job:** in a short anxious session, get back to the conversation or the one artifact they came for, without hunting. The map of places and the four channels that move between them live in [flows.md](../flows.md); this spec is the shell.

## Concept

The signed-in shell is a rail (or a drawer on a phone), a main column, a header bell, and a Coach dock that travels except on Chat. Groups are labels. Chat is home. Proof lives under Paper in the rail and stays its own domain. The word Applications does not appear; the tracker is **Apply**.

There is no `navigation` feature module and no navigation tables. Threads use `conversation.*`. Account uses profile and auth. Movement the Coach initiates uses `app.open`, defined here and listed on [coach.md](coach.md).

## Screens

The shell wraps every signed-in route except `/onboarding`.

### Regions

Every signed-in screen is four layers — main, chrome (rail plus header bell), dock, overlays — with reading order and yield rules defined in [layout.md](../layout.md). This spec owns the chrome layer; the main column belongs to each place's layout type.

### Desktop rail, top to bottom

1. New conversation
2. Thread list (active thread marked; rename and remove use `conversation.*`)
3. **Prepare** (label)
   - Paper, with **Proof** as its child row
   - Pitch
4. **Opportunities** (label)
   - Search
   - Apply
5. Account control at the bottom edge, as in the ChatGPT reference (name from the profile; opens Profile, Settings, sign out)

Only places are rows. CV / Resume and Letter are not rail rows; they are the type filter on `/paper`. Under Paper the rail shows exactly one child row, Proof.

Active state: accent on the current place. Proof marks Paper as parent. `/paper/$paperId` marks Paper. `/applications` marks Apply.

Desktop rail is 16rem wide and stays until 768px, where it becomes the drawer. Dock on desktop is 20rem by at most 32rem, bottom-right, so it never covers the band. On a phone the dock is a bottom sheet at 70vh.

`/coach`: the conversation owns the main column. No second copy of the thread list. No dock. The active thread is `/coach?thread=<id>`.

Artifact screens (Paper, Proof, Pitch, Search, Apply, Profile, Settings): main column is the artifact. Coach dock travels. Bell stays in the header.

### Mobile

ChatGPT pattern, not bottom tabs (tabs would make Coach one of five equals). Full-screen destination; a drawer holds the same rail logic (threads, Prepare, Opportunities, Account). Dock is a sheet on artifact screens. Touch 44px. `prefers-reduced-motion` on drawer and dock.

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
| No threads yet | New conversation is the only thread action; starters live on `/coach` |
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

The rail is never empty once signed in: Chat, Prepare, and Opportunities are always there. An empty thread list still shows New conversation. Empty states inside a place belong to that feature.

## Out of scope

Command palette, customizable order, unread badges on nav, gamified streaks, Proof as a root-rail peer, Prepare or Opportunities as screens, putting Profile or Settings in the core rail, the word Applications in the UI, a `navigation` feature module.
