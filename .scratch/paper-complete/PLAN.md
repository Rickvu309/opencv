## Objective

### What
Finish Complete My Paper so Drive and Docs are one room, I write on the output, an upload can start a built CV without a fake parse, a Proof can be Arranged and Published as a considered page, and the personal link is a sentence plus a span record.

### Why
The list and the opened paper still feel like two apps. The remaining drift is the shell, write-on-the-page, upload honesty, Proof-to-the-web, and the personal link.

### Out of Scope
- Profile, Pitch, Search, Application, Coach, and Discover screens
- Real PDF extract, email sync, Granola, or any fake scan
- Editing a paper on the Application board
- Reopening Paper nouns or a third product grill
- Absorbing tokens into DESIGN.md
- Coach thumbnail inheriting Docs
- Graphs and “anything” on a Proof

### Constraints
- Product locks in `docs/paper.md`; visual locks in `.scratch/paper-redesign/spec.md`
- All writes through `paper.*` on applyAction
- Tests only at applyAction and snapshot/span helpers
- Uploads stay a sibling list, not a fourth paper type (ADR 0003)
- Never say dump or Prepare on screen
- One My Paper shell: band stays mounted; body is a slot
- No `src/` tree

---

## Success Metrics

| Metric | From | To | Verification |
|--------|------|----|-------------|
| Paper action suite | Existing paper tests pass; unpublish and proof kinds missing | applyAction covers create, theme, upload sibling, note kinds, Arrange, publish, unpublish, letter situation | `source "$NVM_DIR/nvm.sh" && nvm use 24 && npm test -- lib/paper` |
| Span / snapshot seam | Day-grid helper still asserted; identity is a name | Snapshot filters Arrange; spans place from dates or Publish day; sentence helper; no day-grid assertion | `source "$NVM_DIR/nvm.sh" && nvm use 24 && npm test -- lib/paper/spans.test.ts lib/paper/share.test.ts` |
| Typecheck | Current tree typechecks | Still typechecks after the five tickets | `source "$NVM_DIR/nvm.sh" && nvm use 24 && npx tsc --noEmit` |
| Forbidden copy | Proof empty body says “Dump now” | dump and Prepare absent from Paper screen strings | `rg -n "Dump now|\\bPrepare\\b" lib/i18n/messages.ts app/\(app\)/paper app/p app/u` exits 1 for Paper UI (rail `prepare` key may remain) |

---

## Context Docs

| Doc | Path | Read When |
|-----|------|-----------|
| Glossary | CONTEXT.md | Naming any noun |
| Placement | docs/map.md | Adding a file |
| Product lock | docs/paper.md | Behaviour questions |
| Visual lock | .scratch/paper-redesign/spec.md | Look and motion |
| Build lock | .scratch/paper-complete/spec.md | Seams and stories |
| Tickets | .scratch/paper-complete/issues/ | Session slice |
| Proof ADR | docs/adr/0003-proof-and-uploads.md | Upload vs paper |
| Architecture | docs/map.md | Write path |

## Summary

- Goal: Complete My Paper as five vertical slices, starting at one room
- Risk: MEDIUM — existing Paper UI and public pages, no schema migration
- Mode: Single-agent
