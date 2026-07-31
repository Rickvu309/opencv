# Lesson log

Learnings captured while building OpenPath. One entry per lesson, newest last. Workers: when you learn something reusable during a ticket, append it here in the same format.

## 2026-07-31, backlog v2 build (tickets 01 to 18)

1. **Write the architecture doc before the first build ticket.** CONTEXT.md plus docs/architecture.md let 15 build tickets run against one source of truth. Every worker brief started with "read these two files"; drift stayed near zero across 8 different agent runs.
2. **A domain language file prevents naming rot.** "Opportunity, not job", "Dream is a flag, not a status", "one Copilot, not assistants" held across the whole codebase because CONTEXT.md fixed the words on day one.
3. **The trust boundary is a design rule, not a feature.** "AI drafts, the user accepts, edits, or dismisses" decided dozens of small UI questions without discussion. One absolute rule beats many local judgments.
4. **Ticket briefs should state what the next ticket will deepen.** Ticket 06 built tab scaffolds and named which tickets (07, 08, 10) would fill them. No tab was ever blank and no ticket rebuilt another's structure.
5. **Seed data is product design.** The persona (Mai Tran) with coherent dates, one low-credibility posting, one stale opportunity, and one raw unanalyzed opportunity made every AI behavior demonstrable. Generic seed data would have hidden half the features.
6. **Health check a flaky worker with a trivial prompt before sending a big brief.** `droid exec --auto low "Reply with: ready"` separates service outage from a bad brief in seconds. Droid died twice mid-ticket today; both times the check confirmed outage and the work was handed to a fallback agent that finished from the uncommitted state instead of rebuilding.
7. **Uncommitted work from a dead agent is usually salvageable.** Both droid failures happened during final verification, after the build was essentially done. The recovery brief was "review against the original brief, finish, verify, commit", which cost a fraction of a rebuild.
8. **Vercel CLI direct deploys can silently drop tracked files.** `vercel deploy --prod` failed with module-not-found for a file that exists, is tracked, and is pushed; `--force --archive=tgz` did not fix it. The reliable path: `vercel build --prod` locally, then `vercel deploy --prebuilt --prod --yes`, then the explicit alias repoint to openpath-app.vercel.app.
9. **A final content-consistency audit finds what per-ticket verification cannot.** The QA pass (docs/qa-16.md) caught a persona whose stated years of experience contradicted her own CV, and three different date references for one opportunity. Each ticket was locally correct; only a cross-surface read caught it.
10. **An audit pass on an integration layer pays for itself.** The Copilot unification audit (ticket 14) found four real defects (context not loading on direct page open, dead handoffs) that per-surface testing had missed.

## 2026-07-31, RDS-976 layout, composition, and typography pass

11. **One named display step beats a one-off large heading per page.** A `.text-display` utility (one step above h1, disciplined line height, same family) let Home's greeting band and Goals' target-direction band share a real hero treatment instead of each page inventing its own oversized heading class.
12. **A quiet uppercase section label groups a dense list without adding another heading level.** Splitting Home's attention queue into "Needs a decision" and "Also worth a look" under a `.text-section-label` (the same treatment the sidebar nav groups already used) cut scanning cost on the highest-traffic surface without a new component.
13. **Don't repeat what the page header already says.** The opportunity detail page's summary band used to re-show role, company, and a breadcrumb the page header already rendered a few pixels above. Removing the duplicate line, not adding one, was the fix; the same audit found the CV detail page had never had the duplicate in the first place, so the fix was really about matching an existing better pattern.
14. **A sandboxed headless Chromium needs its shared libs pointed at explicitly.** `npx playwright install` cannot sudo in this environment; launching still works once `LD_LIBRARY_PATH` includes a prefetched lib prefix (this box keeps one at `~/.pwlibs/root/usr/lib/x86_64-linux-gnu`). Worth checking for a prebuilt lib prefix before assuming headless browser review is blocked.
