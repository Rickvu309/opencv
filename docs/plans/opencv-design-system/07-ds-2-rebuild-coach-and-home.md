## Rebuild Coach and Home on AI Elements (DS-2)

**Depends on.** DS-1.

**Files.**

- [ ] Add stock components under `packages/ui/src/components/` with `pnpm dlx shadcn@latest add message-scroller message bubble input-group trace code-block item collapsible -c apps/web` (the install lines on the Chat, Message, Tool and Confirmation pages, A3). Run `node scripts/ds-codemod.mjs` after.
- [ ] Create in `apps/web/src/components/ai-elements/` the patterns `chat.tsx`, `message.tsx`, `prompt-input.tsx`, `suggestion.tsx`, `confirmation.tsx`, copied from `https://ui.shadcn.com/docs/ai-elements/base/<name>.md`. Replace `tool.tsx` with the Tool pattern.
- [ ] Rewrite `apps/web/src/features/coach/coach-thread.tsx` (487 lines), `coach-tool-line.tsx`, `coach-working.tsx`, `coach-dock.tsx`.
- [ ] Edit `apps/web/src/features/home/thread-view.tsx`, `home-dashboard.tsx`, `home-suggestions.tsx`, `rich-receipts.tsx`, `coach-markdown.tsx`.
- [ ] Delete `apps/web/src/features/coach/coach-runtime.ts`, `coach-runtime.test.ts`, `coach-thread-panel.tsx` (the `AssistantRuntimeProvider` shell), `apps/web/src/styles/coach.css` rules listed in the inventory, `apps/web/src/styles/coach-motion.test.ts`.
- [ ] Edit `apps/web/package.json` and `pnpm-lock.yaml` to remove `@assistant-ui/react`.
- [ ] Edit `apps/web/src/test/design-vocabulary.test.ts` (drop the DS-2 rows from `LEGACY_OVERLAY_ALLOWLIST`, add a rule that forbids `@assistant-ui/` imports).

**Build.**

- [ ] Name the data shape first. A turn renders as a list of `CoachPart`, a union of `{ kind: "text"; markdown }`, `{ kind: "tool"; label; object; status: "running" | "done" | "error"; detail? }` and `{ kind: "diff"; lines }`, derived from the existing `turn-state.ts` reducer and `home/coach-receipt.ts`. One `partRenderers` record keyed by `kind` maps each part to a pattern (Message text, Tool on Trace, Code Block diff). No per-call-site branching.
- [ ] Keep the runtime. `use-coach-turn.ts`, `turn-state.ts`, `thread-store.tsx` and the SSE client stay. The patterns are presentational. The pattern pages wire `useChat` from `@ai-sdk/react` and import types from `ai` (A3). Replace those with `CoachPart` and do not add `ai` or `@ai-sdk/react`.
- [ ] Thread. `Chat` pattern, `MessageScroller` with `MessageScrollerItem` per message and `scrollAnchor` on the person's turns (A3 Chat page), `Bubble` for what the person sent.
- [ ] Steps. Each tool step is a Tool line on Trace with `running`, `error` or done state and the object it touched in the title (verify-app-ui 09). "Worked for Ns" stays as the line's description. Trace's shimmer replaces `.coach-working-bar`.
- [ ] Receipts. `rich-receipts.tsx` diff rows render as a small Code Block with diff lines (A1), which removes `bg-success/10 text-success`.
- [ ] Composer. Prompt Input pattern on `InputGroup` and `InputGroupTextarea`. Enter sends, Shift+Enter adds a line (A3 Prompt Input page). Placeholder "Ask the Coach" on Home, the Thread and the dock (verify-app-ui 02).
- [ ] Markdown. Keep `home/coach-markdown.tsx` as the renderer inside Message. Do not add Streamdown (Appendix B3). Replace `.prose-kit` with stock utilities in that file.
- [ ] Confirmation. Copy the pattern now so DS-4a can use it. Do not wire it to Coach writes. The api has no approval state (`turn-state.ts` declares only `send` and `regenerate` kinds and no pending-approval status), so "ask before a write" needs an api change outside a design-system PR. File it as its own issue and link it in the PR body.
- [ ] Scan every pasted file for `asChild` and convert to Base UI `render`. Record the count in the PR body.

**You see.**

- [ ] `git grep -n "@assistant-ui" -- apps/web` prints nothing, and `pnpm why @assistant-ui/react` in `apps/web` prints nothing.
- [ ] A scripted Coach reply that edits an Apply card shows a Trace line titled with the card, a spinner while it runs, a check when done.
- [ ] Scrolling up during a streamed reply keeps the viewport where the person left it.
- [ ] The receipts diff shows plus and minus lines with no green fill.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `coach-tool-line.test.tsx` asserts by role and text that a done step names its object and a failed step shows its error in a live region. Red at trunk for the new assertions, green at head.
- [ ] `thread-view.test.tsx`, `home-chat.test.tsx`, `paper.coach-turns.test.tsx` drop the `coach-*` class assertions and assert visible text and roles instead.
- [ ] A new `partRenderers` test renders one of each `CoachPart` kind.
- [ ] `design-vocabulary` fails on a scratch `import "@assistant-ui/react"`, then the scratch is dropped.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. verify-opencv scripted Coach send on Home at trunk and head. Save `ds2-regression.png`. Pass when both reach a finished reply with a receipt.
- [ ] Lane 2. verify-app-ui 02, 09, 14. Save `ds2-writing.png`. Pass when all pass.
- [ ] Lane 3. verify-app-ui 04 and 27 (raw error refused, live region present). Save `ds2-errors.png`. Pass when both pass.
- [ ] Lane 4. Keyboard. Tab to the composer, type two lines with Shift+Enter, send with Enter, then Tab to Retry and Undo. Save `ds2-keyboard.png`. Pass when each step works with no pointer.
- [ ] Lane 5. Stream follow. Send a long scripted reply, scroll up mid-stream. Save `ds2-scroll.png`. Pass when the viewport does not jump and a jump-to-latest control appears if the pattern provides one.
- [ ] Lane 6. Accessibility tree via `agent-browser snapshot`. Save `ds2-a11y-tree.png`. Pass when each Trace line is a button with an accessible name and its status is exposed as text.
- [ ] Lane 7. verify-app-ui 24 and 25 on an open Thread with a running step. Save `ds2-motion.png`. Pass when both pass.
- [ ] Lane 8. Undo. Trigger a scripted edit, press Undo on its receipt. Save `ds2-undo.png`. Pass when the change reverts and the receipt says so.
- [ ] Lane 9. Paper dock. Open the Coach from an open CV and send. Save `ds2-paper-dock.png`. Pass when the reply renders in the same patterns as Home.
- [ ] Lane 10. Gates. `scripts/review-pr.sh <pr#>`. Save `ds2-gates.png`. Pass when it prints `OK`.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Metric A on the entry chunk plus the Home route chunk, Metric B on Home and an open Thread.
- [ ] Probe. Three builds and three checker runs per side, interleaved trunk then head, in two worktrees, per the perf method.
- [ ] Baseline. Trunk medians first.
- [ ] Rule. Entry plus Home chunk gzip at head no larger than trunk (the removed library is expected to outweigh the added components, a guess this rule tests). Home under 2000 ms. A larger number fails.

**Risks.** The external-runtime adapter carried edit, retry and regenerate semantics, so lanes 4 and 8 drive each one. Message Scroller behavior under SSE chunking is unproven here (lane 5). Coach approval stays unshipped until its own issue lands.

**Review gate.** The operator reviews before merge.

- [ ] Save lanes 1, 5 and 8 screenshots and a 30 to 60 second video of a Home send, a tool step and an Undo as `/home/quan/tmp/opencv-review/DS-2-review.mp4`. Post them in chat for the operator. Stop at merge-ready.

**Merge.**

- [ ] `review-pr.sh` OK, gates green at the exact head, independent review clean, then `gh pr merge <pr#> --squash --admin` and cleanup.
