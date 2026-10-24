## Build the landing page (PR-17)

**Depends on.** PR-2, PR-9, PR-15.

**Files.**

- [ ] Edit `apps/web/src/router.tsx` (the `indexRoute` at lines 33-39).
- [ ] Create `apps/web/src/features/landing/landing-page.tsx`.
- [ ] Create `apps/web/src/features/landing/landing-nav.tsx`.
- [ ] Create `apps/web/src/features/landing/landing-hero.tsx`.
- [ ] Create `apps/web/src/features/landing/landing-pillars.tsx`.
- [ ] Create `apps/web/src/features/landing/landing-surface.tsx`.
- [ ] Create `apps/web/src/features/landing/landing-footer.tsx`.
- [ ] Create `apps/web/src/features/landing/landing-copy.ts`.
- [ ] Create `apps/web/src/features/landing/landing.css`.
- [ ] Create `apps/web/src/features/landing/landing-page.test.tsx`.
- [ ] Create `apps/web/public/landing/coach.webp`, `apps/web/public/landing/paper.webp`, `apps/web/public/landing/apply.webp` and `apps/web/public/landing/pitch.webp`, with 390 px crops `coach-mobile.webp` and the matching names for the other surfaces.

**Build.**

- [ ] In `apps/web/src/router.tsx`, change `indexRoute` (line 33) so `beforeLoad` calls `authClient.getSession()` like `signInRoute` (lines 44-49), throws `redirect({ to: "/app" })` when `data` is set, and otherwise returns. Replace the unconditional throw at line 37. Add `component: lazyRouteComponent(() => import("@/features/landing/landing-page.tsx").then((m) => ({ default: m.LandingPage })))`, using the lazy pattern PR-9 sets for the other routes.
- [ ] `LandingPage` renders, in order, a nav, a hero, a pillar strip, four surface sections for Coach, Paper, Apply and Pitch, a CTA band and a footer. It has no logos, testimonials, pricing, changelog, how-it-works strip or language toggle, because ADR-0008 sets English only and the research (section 2.2 items 3, 7, 8, 9) says to leave unreal sections out.
- [ ] Nav shows the renamed logo (`OpenCvLogo` from `apps/web/src/features/app-shell/app-logo.tsx` after PR-2) with wordmark, links to the four surfaces as in-page anchors, a text `Sign in` link to `/sign-in`, and a kit `Button` `Start free` linking to `/sign-up`. The nav is transparent at the top and gains a blurred background after scroll with a 100 ms transition.
- [ ] Hero uses headline option B from the research (section 2.3), "The career coach that gets you your first job.", and the subhead "Chat with a coach, write your CV and letters, track every application, and share a portfolio page." The primary CTA is `Start free` to `/sign-up` and the secondary is `Sign in` to `/sign-in`. Only one filled button sits in the first viewport. Below the CTAs sits `coach.webp`, a real Coach screenshot.
- [ ] Heading type is the kit sans (`font-sans`, Geist Variable, the kit's Inter-class face) at 56 px on desktop and 40 px below the `md` breakpoint, weight 500, tight tracking, line height 1.1, with `text-wrap: balance`. The kit's `font-heading` is a serif, so the landing does not use it. The two sizes are declared once as `--landing-h1-desktop` and `--landing-h1-mobile` in `landing.css`. Every color, radius, border and spacing value elsewhere comes from kit tokens.
- [ ] Layout uses a 1344 px max width (`max-w-[1344px]`), 128 px vertical rhythm between sections on desktop and a smaller step on mobile, and 12 to 16 px panel radius from the kit radius tokens.
- [ ] Each surface section has a 2 to 4 word title (Coach, Paper, Apply, Pitch), one sentence from the research (section 2.4), and one real screenshot with alt text. The five screenshots (hero plus four surfaces) are captured through the `verify-opencv` skill from the seeded starter workspace at 1920 px wide. They are cropped with an edge-fade mask, saved as `.webp` under `apps/web/public/landing/`, and contain no personal data. The run's evidence path goes in the PR body.
- [ ] Theme is light, matching the app shell (the operator chose light on 2026-10-23). The landing uses the kit's light tokens as they are and adds no `dark` class. The dormant `.dark` block in `packages/ui/src/styles/globals.css` line 231 stays untouched.
- [ ] The hero image fades in over 0.8 s with a left-to-right mask sweep, defined in `landing.css` and gated by `@media (prefers-reduced-motion: no-preference)`. Under `reduce` the image is fully visible with no animation, and it is visible without JS. Hover transitions are 160 ms ease-out.
- [ ] A CTA band with two short declaratives and `Start free`, and a footer with the logo, the four surface links and `Sign in`. No invented columns or legal links.

**You see.**

- [ ] Signed out, `http://localhost:<web port>/` stays on `/` and shows an `h1` reading "The career coach that gets you your first job." At trunk the same request ends on `/sign-in?redirect=%2Fapp`.
- [ ] Signed in, `/` ends on `/app` with no landing flash.
- [ ] The page shows `h2` headings Coach, Paper, Apply, Pitch in that order, each above one screenshot, and the same light background token as `/sign-in`.
- [ ] `Start free` is a link with `href="/sign-up"` in the nav, the hero and the CTA band, and `Sign in` has `href="/sign-in"`.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/web/src/features/landing/landing-page.test.tsx` gains cases for the headline text, the `Start free` and `Sign in` hrefs, the four surface headings in order, the absence of the words Pricing, Testimonials and any language control, an `alt` on every image, and a root element with the `dark` class. A second case mocks `authClient.getSession` (`apps/web/src/lib/auth-client.ts`) to return a session and asserts the index route `beforeLoad` throws a redirect to `/app`, and returns normally without one. Red first because the module does not exist, then green. Run `pnpm --filter web test -- src/features/landing`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Open `/` signed out at trunk and at head with `agent-browser`. If trunk lacks the landing page, record that trunk redirects `/` to `/app` and then to `/sign-in?redirect=%2Fapp`, and gate that head keeps the URL at `/` and renders the `h1` and four surface headings. Save `trunk-vs-head-root.png`. Pass when trunk ends on `/sign-in` and head ends on `/` with the `h1` text from option B.
- [ ] Lane 2. Desktop at 1440 by 900, signed out, full-page screenshot. Save `landing-desktop.png`. Pass when the `h1`, then a pillar strip, then `h2` Coach, Paper, Apply, Pitch in that order, then the CTA band and the footer appear, and `document.body.innerText` contains none of Pricing, Testimonial, Changelog.
- [ ] Lane 3. Mobile at 390 by 844, signed out. Save `landing-mobile.png`. Pass when `document.documentElement.scrollWidth` is at most 390, the `h1` computed `font-size` is 40px, the hero `Start free` button is at least 358 px wide, and every screenshot fits its column.
- [ ] Lane 4. Sign up through the UI, then open `/` in the same session. Save `signed-in-redirect.png`. Pass when the final URL path is `/app` and the landing `h1` never appears in a snapshot taken right after navigation.
- [ ] Lane 5. Click each CTA signed out. Save `cta-links.png`. Pass when the nav, hero and band `Start free` links all land on `/sign-up`, the `Sign in` link lands on `/sign-in`, and each link's `href` attribute matches.
- [ ] Lane 6. Emulate `prefers-reduced-motion` once as `reduce` and once as `no-preference`. Save `reduced-motion.png`. Pass when under `no-preference` the hero image computed `animation-duration` is 0.8s with a mask, and under `reduce` its computed `animation-name` is `none` and `opacity` is 1.
- [ ] Lane 7. Keyboard only. Press Tab from the page top through the nav and hero. Save `keyboard-nav.png`. Pass when focus visits the logo, the surface links, `Sign in` and `Start free` in reading order, each focused element shows a visible focus ring (nonzero outline or ring shadow), and Enter on `Start free` lands on `/sign-up`.
- [ ] Lane 8. Run Lighthouse against `pnpm --filter web build` plus `pnpm --filter web preview`, in desktop and mobile modes, on `/`. Save `lighthouse.png` of the summary. Pass when performance and accessibility are both 90 or higher in both modes.
- [ ] Lane 9. Console and assets. Load `/` at 1440 and 390 with the console captured. Save `console-assets.png`. Pass when there are zero console errors and warnings, every `img` has `naturalWidth` above 0 and a non-empty `alt`, the five landing screenshots exist under `apps/web/public/landing/`, and the PR body links a `/home/quan/tmp/opencv-verify/<run>/` directory holding the capture run.
- [ ] Lane 10. Theme and layout. Open `/` and then `/sign-in` at 1280 px and read the computed background color of `document.body` on both, plus the `h1` computed `text-wrap` and the content width of the landing container. Save `theme-light-and-layout.png`. Pass when both pages share the same light background color, no element on `/` carries the class `dark`, the `h1` computed `text-wrap` is `balance`, and the content container is at most 1344 px wide.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. The landing route's initial JavaScript transfer size and its Lighthouse largest contentful paint, plus the signed-out `/app` entry JavaScript at trunk and at head.
- [ ] Probe. Build and preview trunk and head. Run Lighthouse mobile three times on `/` at head and on the signed-out `/app` entry at both. Interleave trunk and head. Read JS bytes from the `total-byte-weight` and network-requests audits, and LCP from the `largest-contentful-paint` audit. Trunk has no landing page, so the landing numbers use absolute budgets.
- [ ] Baseline. Record the trunk median for the signed-out `/app` entry JavaScript and LCP first. Trunk `/` redirects, so record that.
- [ ] Rule. Landing performance below 90, landing LCP above 2.5 seconds, or landing initial JavaScript above 200 kB transferred fails. The head `/app` entry JavaScript more than 2 percent above trunk fails, because landing code must load only on `/`.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2 and lane 3 screenshots into `/home/quan/tmp/opencv-review/PR-17-review-desktop.png` and `/home/quan/tmp/opencv-review/PR-17-review-mobile.png`. Copy lane 10 into `/home/quan/tmp/opencv-review/PR-17-review-theme.png` so the operator sees dark and light and picks one.
- [ ] Record a 30 to 60 second video of the change on a lane worktree. Save it as `/home/quan/tmp/opencv-review/PR-17-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.
