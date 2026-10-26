# Decision trail: OpenCV redesign run

Exit: 183 option frames placed (coverage.js), no clipped/collapsed layout, one chosen option per row, canvas regrouped into labelled zones.

| Row  | Pick | Why                                                                                |
| ---- | ---- | ---------------------------------------------------------------------------------- |
| W3.1 | B    | Scope chips + dense rows; same palette family across 3.x. C accent block too loud. |
| W3.2 | B    | Properties strip for selection; scannable. A has footer overlapping last row.      |
| W3.3 | B    | Keeps actions in the palette; consistent with 3.1/3.2.                             |

## Incidents

- pen.dev editor closed twice during multi-frame Export (6-12 frames, scale 0.5-0.6) while 8 agents were writing. Reopen via execute works; data persisted (114/183 after first reopen). Hypothesis: heavy export on 11 MB doc. Action: no exports until agents finish; then export 3 at a time.
- Kit fix: "seal-check" is not in Phosphor; Proof icon is now "medal" in OC Menu (n1knc) and the W2.1 A starter (U2XxZ9).
- Agents report that pen.dev refuses absolute children inside a shell instance; overlays are built as 1440x900 wrapper frames holding shell + scrim + dialog. Accepted.
- Consistency: daily caps differ (W2 20/60/10, W10 40/20/8). Live copy says Light/Power have smaller caps than Free. Unify to Free 20, Light 10, Power 5 across W2 and W10 text.
- Caps unified: 21 strings in W2.3, W2.7, W10.1 now Free 20 / Light 10 / Power 5; Light described as stronger, not faster.
- Coverage 182/183 after W1-4, W6-10 returned. W5.8C pending.
- Choice marking: tag chosen frame in place (black 4px outline + "Chosen" label above) and write the pick on the Workflow Map. No copying of 61 frames (file is 11 MB and the editor already drops under load).
- Modal overlays: agents could not insert into shell instances, so most scrims cover only the main panel. Fix only on chosen modal screens by dimming the sidebar and gutters.
  | W1.1 | A | B and C show the user's documents before sign-in (privacy leak). |
  | W1.2 | C | Covers lockout + reset with no data leak; B has a stray "Clear demo" button. |
  | W1.3 | A | Least friction, matches 1.1. |
  | W1.4 | A | Inline taken-email error, strength meter, rules; same family as 1.3. |
  | W1.5 | A | Request and sent states side by side. |
  | W1.6 | B | List with explanation inspector; Linear-native. |
  | W1.7 | C | Reassures "nothing is lost"; dialog small. Needs sidebar dimmed. |
  | W2.1 | A | Centered composer + checklist; reference screen. |
  | W2.2 | A | Same Home layout as first run; next step card leads. B's board panel is nice but splits Home into two layouts. |
  | W2.3 | C | Mode cards make the caps legible; menus anchored to composer. |
  | W2.4 | B | Right "changes in this thread" panel = undo history. |
  | W2.5 | B | Same right panel shows the run; Stop in composer. |
  | W2.6 | B | Activity panel logs the failed save; calm message, Try again. |
  | W2.7 | B | Turns panel shows Free/Light/Power usage. B family across 2.4-2.7. |
  | W2.8 | C | Copy says what stays (CV, Apply) and what goes. Needs sidebar dimmed. |
  | W4.1 | B | List + inspector with properties and key hints. |
  | W4.2 | B | Three clear starts plus template preview in the inspector slot. |
  | W4.3 | B | Row menu anchored to selected row; inspector stays. |
  | W4.4 | B | Same shell as 4.1; Clear search / Create Proof as command rows. |
  | W4.5 | B | Compact confirm; whole screen dimmed. |
  | W5.1-5.8 | B | One editor model: centered sheet + right inspector that swaps content (suggestion, templates, tailor, share, export, conflict, length). Matches W4 list+inspector. A's dialogs and C's coach column each break the model on some rows. |
  | W6.1-6.4 | B | Doc list + document + properties inspector; same model as W4/W5 B. |
  | W7.1 | C | Kanban kept, next-moves strip shows needs-you items first. |
  | W7.2 | A | Inline paste-a-link start, plus coach fallback. |
  | W7.3 | A | Filter chips + checkbox popover + clear no-match. |
  | W7.4 | A | Drop zone + ghost slot show the mechanics. |
  | W7.5 | A | Full month grid, accent only on today's deadline. |
  | W7.6 | A | Calm empty week, one action. B list view abandons the board identity of Apply. |
  | W8.1-8.3 | A | One add dialog (Link/Text tabs) carries scan, progress and failure. |
  | W8.4 | B | Existing-vs-new comparison before choosing. |
  | W8.5-8.7 | A | Board + right detail panel, matches W7 board. |
  | W8.8 | C | Offers Move to Closed (keeps history) before Delete. |
  | W9.1-9.4 | B | Sections rail + preview + inspector = Paper editor model. |
  | W9.5 | C | Big claim headline and proof cards for recruiters. |
  | W9.6 | A | Calmest 404 with one action. |
  | W10.1-10.4 | B | Settings nav replaces sidebar list (Linear settings); delete as drawer keeps context. |
  | W10.5 | A | Real Apply board + offline strip + toasts, consistent with W7 A. |
  | W10.6 | A | Calm, two actions. |

## Fix pass

- 8 chosen modal screens wrapped (shell + 4 scrim rects) so sidebar and gutters dim: W1.7C, W2.8C, W8.1A, W8.2A, W8.3A, W8.4B, W8.8C, W10.4B.
- W10.5A card logos/dates fixed (EC/AG/LS/RB/AG, real dates).
- 61 label strips + 6px outline on chosen frames; picks on Workflow Map.

## Reorg

Zones top to bottom: 01 Brand, 02 Design system, 03 Live app today, 04 Workflows (map + 10 columns x 3 options), 05 Marketing site, 06 References.
Final check: 289 top-level nodes, 0 overlaps, 183/183 screens.
