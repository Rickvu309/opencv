# Consistency: one voice, no motion drift

- **Type:** `wayfinder:grilling`
- **Status:** open
- **Assignee:** minhquanvu3902@gmail.com (via Claude)
- **Blocked by:** [Screens: eight surfaces at Emil's bar](02-screens.md)
- **Map:** [Map, OpenPath at a production UI/UX bar](../map.md)

## Question

Reviewing screen by screen cannot see across screens. After eight surfaces have been
worked independently, what has drifted?

### 1. Vietnamese UX writing voice

One voice across the product, tone flexing with the stakes. Read every user-facing string
in sequence rather than per screen; that is the only way inconsistency shows up.

- Is the same thing called the same name everywhere? The Career Map rename already left
  drifted references once.
- Verb-first buttons, sentence case applied consistently, errors written as instructions,
  empty states that point forward.
- Coach voice specifically: it speaks in first person to the user and its replies are long.
  Does it read like one coach, or several? (`components/coach/replies.ts`)
- Tone is the user's judgment. Draft against `better-writing`, then put it to them.

### 2. Motion and interaction drift

- Every screen on the one vocabulary from *Foundations*; no stray easings or durations.
- Press feedback, hover, focus and disabled treated the same way everywhere.
- Reduced motion honoured on every animation added during *Screens*.
- Re-run the inventory that found the original drift and confirm it comes back clean:

```bash
grep -rohE "duration-[0-9]+|ease-[a-z-]+|cubic-bezier\([^)]*\)|transition-[a-z]+" \
  app components --include="*.tsx" | sort | uniq -c | sort -rn
```

### 3. Fold the result back into the system

`DESIGN.md` should describe what the app now actually is. Anything decided during
*Foundations* or *Screens* that never made it into the doc gets written down here.

## Definition of done

One voice confirmed by reading the strings end to end, the motion inventory clean, and
`DESIGN.md` matching the shipped interface.

---

## Partial resolution, run before *Screens* closed

**This ticket is still blocked and stays open.** It was worked while *Screens*
had 4 of 8 surfaces done, so anything below about Coach, Profile or Career Map
may shift when those are finished. The motion inventory and the string sweep
read what actually shipped, so they were worth doing now; both need re-running
once *Screens* closes.

### Motion, the vocabulary existed but nothing used it

*Foundations* tokenised `globals.css` and left every component on Tailwind's
built-in utilities, so the inventory came back **byte-identical** to the one that
motivated the ticket. The drift was real:

| Site | Was | Now |
| --- | --- | --- |
| onboarding ×3, `path-canvas` | `ease-out`, Tailwind's `cubic-bezier(0,0,0.2,1)`, not the documented enter curve | `ease-enter` |
| `document-panel` ×2 | `ease-[cubic-bezier(0.2,0,0,1)]` longhand | `ease-snap` |
| `app-shell` | `duration-150`, off-scale | `duration-[var(--duration-press)]` |
| `ui/progress` | `transition-all` (banned; only `translateX` animates) | `transition-transform` + tokens |

**A trap worth knowing:** `--ease-*` is a Tailwind v4 theme namespace, so
`ease-enter` works. `--duration-*` is **not**, a bare `duration-surface`
generates nothing and silently falls back to 0.15s. I hit this: the first pass
looked correct and measured 0.15s where 0.3s was intended. The arbitrary form
`duration-[var(--duration-surface)]` is required, and this is now in `DESIGN.md`.

App code is clean: no `ease-linear`, `ease-in-out`, `transition-all`, inline
`cubic-bezier`, or off-scale durations. `duration-200`/`300` literals remain
where they already match the scale; `DESIGN.md` states the rule so a grep finds
any other number. Vendor `components/ui/` keeps shadcn's defaults by convention,
overrides belong in `globals.css`.

### Writing

**The product spoke English to screen readers.** Every visible string is
Vietnamese, but the accessible names shipped as shadcn defaults: "Close",
"Toggle Sidebar", "Sidebar", "Displays the mobile sidebar." Localised using the
app's own terms (`thanh bên`, `Đóng`). Only `sheet` and `sidebar` were reachable;
`dialog`, `carousel` and `breadcrumb` have no consumers and were left alone.

**One toast used two names for one feature**, `thread.tsx` described the
Career Map as "bản đồ hướng đi" while its own button said "Xem Career Map".
Now "Career Map" in both. ("hướng đi" as a common noun elsewhere is natural
Vietnamese, not drift.)

**A filter empty state was a dead end**, "Không có việc nào khớp bộ lọc" with no
exit, while the filter that caused it sits in a menu the user must remember to
reopen. It now names the cause and offers **Hiện tất cả nguồn việc**; verified
0 rows → 13.

**Coach voice reads as one coach**, replies are 624–755 chars, first-person
`mình` to `bạn`, evidence before recommendation. No change needed.

### For the user to decide

**"Kế hoạch" vs "Lộ trình" for the same screen.** The nav says *Kế hoạch*; the
page heading says *Lộ trình tới X*; onboarding and the landing page both promise
a *lộ trình*. Defensible as section-name vs artifact-name, but a user clicks one
word and lands on another. Tone and terminology are the user's call, so this is
left as a question rather than a rename.

### Still to do when *Screens* closes

- Re-run both sweeps over Coach, Profile, Career Map once they have had the five passes.
- The `aria-pressed` vs RadioGroup split in onboarding (logged on *Screens*).
- ~~Press/hover/focus/disabled treated the same everywhere; not yet audited.~~ **Audited
  2026-08-04.** The press half is closed. `components/ui/button.tsx` already shipped the
  idiom (`active:not-aria-[haspopup]:translate-y-px` over a bare `transition`), but no raw
  `<button>` had adopted it, so a control's press feedback depended on whether whoever wrote
  it reached for the primitive. Eight raw controls across Career Map, Coach, Profile and the
  shell now carry it, and `app-header.tsx` no longer narrows the primitive's `transition` to
  `transition-colors`, which had been silently dropping the transform from the eased set.
  Popover and menu triggers are deliberately excluded, matching the primitive's own
  `not-aria-[haspopup]` carve-out: a trigger that sinks as its menu opens reads as a glitch.
  Hover and focus were already consistent. Disabled is still unaudited.
