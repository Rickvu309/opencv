# Design system migration plan (DS-1 to DS-5)

OpenCV's signed-in app moves off the OpenPath-era overlay (bespoke tokens, type roles, hand-rolled kit pieces, ADR-0002 and ADR-0010) onto current shadcn/ui. The people who notice are the student using Home, Coach, Paper, Apply and Pitch, who gets stock shadcn controls, one motion system and a chat built from AI Elements, and the next engineer, who installs from a registry instead of extending a private vocabulary. The rule the program enforces is one sentence. App and kit code use only shadcn's own CSS variables plus two motion tokens (150 ms micro, 280 ms panel), and `design-vocabulary.test.ts` fails on anything else. The PRs run in this order. DS-1 foundation, then DS-2 Coach and Home, DS-3 Apply, DS-4a Paper and DS-4b Pitch in parallel, then DS-5 removal.

Base decision, in one line. Keep `base-nova` on `@base-ui/react`. Every registry the operator named either ships a Base UI variant or is primitive-free (Appendix A, facts A1 to A9).

Read-only planning run on main `88fe915`, 2026-10-24. Nothing was installed, built or tested. Every count below is a `grep` on `apps/web/src` and `packages/ui/src` at that SHA, excluding `globals.css` unless stated. Registry facts carry their URL. Guesses are labelled.

1. [How to read this](opencv-design-system/00-how-to-read-this.md)
2. [Inventory of the overlay and its replacement](opencv-design-system/01-inventory-tokens.md)
3. [Class roles in app stylesheets](opencv-design-system/02-inventory-class-roles.md)
4. [Kit components and helpers in `packages/ui/src`](opencv-design-system/03-inventory-kit-and-governance.md)
5. [Keep base-nova on Base UI](opencv-design-system/04-keep-base-nova-on-base-ui.md)
6. [Program checklist](opencv-design-system/05-program-checklist.md)
7. [Lay the shadcn foundation (DS-1)](opencv-design-system/06-ds-1-lay-the-shadcn-foundation.md)
8. [Rebuild Coach and Home on AI Elements (DS-2)](opencv-design-system/07-ds-2-rebuild-coach-and-home.md)
9. [Move the Apply board onto Kibo kanban (DS-3)](opencv-design-system/08-ds-3-move-the-apply-board-onto-kibo.md)
10. [Move the Paper editor onto stock pieces (DS-4a)](opencv-design-system/09-ds-4a-move-the-paper-editor.md)
11. [Move Pitch onto stock pieces and the Kibo contribution graph (DS-4b)](opencv-design-system/10-ds-4b-move-pitch-onto-stock-pieces.md)
12. [Remove the overlay and the dead CSS (DS-5)](opencv-design-system/11-ds-5-remove-the-overlay.md)
13. [Close the program](opencv-design-system/12-close-the-program.md)
14. [Appendix A. Prototype evidence and registry facts](opencv-design-system/13-appendix-a-prototype-evidence.md)
15. [Appendix B. Alternatives rejected, and defaults applied](opencv-design-system/14-appendix-b-alternatives-rejected.md)
16. [Appendix C. Risks](opencv-design-system/15-appendix-c-risks.md)
17. [Appendix D. Links](opencv-design-system/16-appendix-d-links.md)
18. [Appendix E. What #308 and #314 keep and what DS-4 replaces](opencv-design-system/17-appendix-e-what-308-and-314-keep.md)
19. [UI registry research (fetched 2026-10-24)](opencv-design-system/18-appendix-f-registry-research.md)
