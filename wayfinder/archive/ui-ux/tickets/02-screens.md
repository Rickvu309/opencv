# Screens: eight surfaces at Emil's bar

- **Type:** `wayfinder:prototype`
- **Status:** open
- **Assignee:** minhquanvu3902@gmail.com (via Claude)
- **Blocked by:** — (was *Foundations: one store, one motion vocabulary, one edit pattern*, closed)
- **Map:** [Map, OpenPath at a production UI/UX bar](../map.md)

## Question

Does each surface hold up at Emil's bar, and if not, what changes?

Blocked deliberately: polishing Todo before the Todo/Plan overlap is decided, or animating
a screen before the motion vocabulary exists, is wasted work.

**This does not fit one session.** Work the checklist across several sittings, one surface
at a time, ticking as each is verified in the browser. The ticket closes when every box is
ticked.

## The surfaces

- [x] **Landing** (`app/page.tsx`), heading leading was *tighter* on mobile (1.11) than desktop, colliding Vietnamese tone marks on a 4-line heading; sentences now hold their own lines at both widths; feature row stacked instead of squeezing 3 wrapped labels into 375px; CTAs 44px and full-width on mobile. Contrast verified 18.3 / 5.51.
- [x] **Onboarding** (`app/onboarding/page.tsx`, 4 steps, own layout), `fieldClass` overrode the primitives' `text-base md:text-sm` with a flat `text-sm`, so every field was 14px and iOS Safari zoomed the page on focus; "Kéo thả" told phone users to drag and drop; footer controls now 44px and the primary fills the bar on mobile.
  - *Left for Consistency*: the role picker uses `aria-pressed` toggle buttons while the certainty question right below it uses a RadioGroup, two single-choice controls, two keyboard models.
- [ ] **Coach** (`app/(app)/coach/page.tsx` + `components/coach/`), *partial*: swept at 375px, no overflow, composer and suggestion cards hold up, dock correctly absent here. The five passes (motion, writing, states) have not been done.
- [ ] **Profile** (`app/(app)/profile/page.tsx` + `components/profile/`), *partial*: swept at 375px, no overflow, the mobile push nav works. The five passes have not been done.
- [ ] **Career Map** (`app/(app)/career-map/page.tsx` + `components/career/path-canvas.tsx`)
- [x] **Plan** (`app/(app)/plan/page.tsx` + `components/plan/entry-row.tsx`), entry rows overhung the viewport by 23px at 375px, clipping titles and the disclosure chevron: `grid-cols-[auto_1fr]` resolves to an `auto` minimum that will not shrink, fixed with `minmax(0,1fr)`. Bottom padding now clears the fixed coach strip, which was sitting on the last row.
- [x] **Todo** (`app/(app)/todo/page.tsx`), the detail pane was `hidden md:flex`, so on a phone tapping a task selected it and showed **nothing**; it now opens as a bottom sheet, with the header kept clear of the sheet's close button. List scroller clears the coach strip.
- [ ] **Shell** (`components/app-shell.tsx`, `app-sidebar.tsx`, `app-header.tsx`, `coach-dock.tsx`, `help-button.tsx`), *partial*: the rail reused its 28px desktop row height as the mobile nav; now 40px on touch, 28px unchanged on pointer. Header, dock and help button not yet reviewed.
  - The fixed coach strip overlaps page content on mobile wherever a page scrolls: fixed on Plan and Todo per-page, but **Profile and Career Map still need the same clearance**, and a shared solution would be better than a fourth copy.

## What each surface gets

Same five passes every time:

1. **Emil's taste**, the unseen details. Component feel, press states, transform origins,
   what happens between states. Report findings in the required Before/After table.
2. **The motion vocabulary** from *Foundations*, applied, plus the animation
   opportunities this particular surface is missing.
3. **The `better-*` floors**, layout, typography, colour, accessibility, writing.
   Vietnamese copy drafted against `better-writing`; tone is the user's call to correct.
4. **States**, empty, loading, error. Only onboarding has any today (skeletons at
   `app/onboarding/page.tsx:231`); every other screen assumes the happy path.
5. **375px**, verified in the browser rather than inferred from `sm:` classes. Career Map's
   canvas and Profile's inspector have both broken at narrow widths before.

Plus the standing constraint: the surface renders from the store, and survives the Coach
mutating it while the user is looking at it.

## Definition of done

Every box ticked, each fix landed in code and seen in the browser at both widths.
