---
name: verify-marketing-links
description: "Check that every link a visitor can click on a marketing page lands on a real route, and that every in-page hash has an element. Use after any change under apps/web/src/features/landing, apps/web/src/routes/landing-*, apps/web/src/router.tsx, or when adding a marketing page."
---

# Verify marketing links

A visitor on a marketing page must not click a link that goes nowhere. This check enumerates every marketing route and every `<a href>` those pages render. It is the check for that promise. Follow it when you change the landing, the router, or a marketing page. Read it before you edit, run the one command after you edit, and update the table in the same change when you add a route.

## Properties

Each property is one sentence. The harm is the next sentence.

P1. For every marketing page, every rendered `<a href>` that is internal resolves to a registered route in the route tree from `createAppRouter`, params included, and the matched leaf is not the not-found page. A click that opens the not-found page, or no route at all, breaks the promise the label made.

P2. For every internal href with a hash (`/#paper`, `/help#coach`), the target page, once rendered, has an element with that id. The browser stays at the top of the page and the visitor never reaches the section the link named. The old nav bug rendered Help as `/#elp`.

P3. Every route in the route tree is classified in `ROUTE_TABLE` as marketing or not-marketing. An unclassified route fails, so a new page cannot skip the check. A marketing route whose path contains `$` needs `enumerate` so every instance is rendered. A param route with no enumerator, or an enumerator that returns no paths, fails. A new page can ship a dead link that this check never sees.

P4. `filterHelpTopics` returns, for every query string, a sub-list of the topics in order, every returned question matches the query by the rule below, no matching question is dropped, and a blank or whitespace query returns everything. Help search hides an answer that matches, or shows one that does not.

## The help-filter rule

`filterHelpTopics` in `apps/web/src/features/landing/help/help-copy.ts` does this:

- `needle` is `query.trim().toLowerCase()`.
- An empty needle returns the input topics unchanged: every topic, every question, same order.
- Otherwise, walk topics in order. A topic is kept when `` `${title} ${blurb}` `` lowercased contains `needle`, and then every question is kept. If the label does not contain `needle`, keep the topic only with the questions whose `` `${question} ${answer}` `` lowercased contains `needle`, in order. Drop the topic when that question list is empty.

Matching is `String.prototype.includes` after `toLowerCase` on both sides. It is not a regex.

## Why this tool

TypeScript has no practical verifier for these properties. P1–P3 are a finite domain: every marketing route instance times every `<a href>` that instance renders. The check walks that whole domain in vitest and jsdom. It uses `createAppRouter` from `apps/web/src/router.tsx` and `renderApp` from `apps/web/src/test/render-app.tsx`. A pass covers every case in that domain, not a sample. P4 is a pure function of every string, and the string space is infinite, so the check uses fast-check 4.10.2 (exact `devDependency` of `apps/web`, already resolved in `pnpm-lock.yaml`) on the real `filterHelpTopics`. A pass of P4 is a search up to the bounds below, not a proof of every string.

## How to run

From the repo root:

```bash
pnpm --filter web verify:marketing
```

That script is `apps/web/package.json` `verify:marketing`. It runs only:

- `apps/web/src/test/marketing/marketing-links.verify.test.tsx`
- `apps/web/src/test/marketing/help-filter.property.test.ts`

Exit 0 means all four tests passed. A non-zero exit prints the counterexample. The run is a few seconds. `pnpm --filter web test` also runs these files. Do not start a dev server.

## How to read a failure

A link failure is four lines:

```
page: /about
link: Coach
href: /#coach
why: no element with id "coach" on /
```

`page` is the marketing page that rendered the anchor. `link` is its text. `href` is the `href` attribute. `why` is either `matched the not-found page <leaf id>`, `matched no route for <path>`, `matched only the root layout for <path>`, or `no element with id "<id>" on <path>`.

The Help regression looks like this:

```
page: /
link: Help
href: /#elp
why: no element with id "elp" on /
```

`pageHref` in `landing-nav.tsx` only returns `/pricing` and `/help`. Any other nav path falls through to `to="/"` and `hash={href.slice(2)}`. `/help` with Help removed from that `if` becomes hash `elp`. A future `/blog` nav path becomes `/#log` the same way. `FooterAnchor` in `landing-footer.tsx` already branches on `href.startsWith("/#")` and passes any other path to `Link`. A `/#elp` or `/#log` failure is a product bug in `pageHref`, not a bad table row.

A route-table failure is a short block:

```
unclassified route
id: /scratch-unclassified
fullPath: /scratch-unclassified
why: router.tsx has this route and route-table.ts does not list it
```

Other blocks are `stale route`, `table drift`, `duplicate route`, `missing enumerator`, `empty enumerator`, `bad enumerator path`, `unexpected enumerator`, `marketing path`, and `not-found probe`. The `id` is the TanStack route id (`route.id`). For these routes that id is the full path, and index children keep a trailing slash (`/app/`, `/$/`, `/u/$slug/`).

A fast-check failure prints `Counterexample:` and `Shrunk N time(s)`. Replay that value with `filterHelpTopics`. The HELP_TOPICS property's counterexample is the query string, for example `["A"]`. The generated-topics property's counterexample is `[topics, query]`.

## Real bug or modeling error

- The block names a page, a link, and an href, and `why` is a missing id or the not-found page. The rendered anchor is wrong, or the id was removed. That is a product bug. Open the page that owns the link. Do not edit `ROUTE_TABLE` to hide it.
- The block says `unclassified route`. The route tree grew and the table was not updated. Add a row. If the new route is a marketing page, `kind` is `marketing`. Then rerun. A later P1 or P2 failure on that page is a product bug.
- The block says `stale route` or `table drift`. The table does not describe the router. Fix the table so `id` and `fullPath` match `route.id` and `route.fullPath` from `createAppRouter`. Do not change the router to match a wrong row.
- The block says `missing enumerator`, `empty enumerator`, or `bad enumerator path`. A marketing param route is not fully listed, or a listed path does not match that route. Fix `enumerate`. A path that matches the not-found page is a bad entry, not a reason to drop the route.
- fast-check disagrees with the rule in this skill. If `filterHelpTopics` no longer does what the rule says, and the commit that changed it does not say the search rule changed, it is a product bug. Change the rule only when the commit, the comment on the function, or the Help tests say the promise changed, and write the old rule and the new rule down. Do not change the rule just so the current function passes.

## How to add a marketing page

1. Add the route in `apps/web/src/router.tsx` and to the `routeTree` list. The check then fails with `unclassified route` and prints the id.
2. Add a row to `apps/web/src/test/marketing/route-table.ts` with that `id` and `fullPath`.
3. A static marketing page (`/pricing`, `/about`, `/help`, and `/` for `LandingPage`) uses `kind: "marketing"` and no `enumerate`. The check renders `route.to`.
4. A marketing route whose path contains `$` must set `enumerate` to every concrete path. A later Blog PR adds `/blog` and `/blog/$slug`. `/blog` is a static marketing row. `/blog/$slug` needs `enumerate` returning one `/blog/<slug>` per post in the post table that PR adds. There is no post table in the tree today. Do not invent slugs. An empty list fails. A pattern such as `/blog/$slug` fails.
5. Anything else still needs a row: `app` (routes under `/app`, including redirects such as `/app/proof`), `auth` (`/sign-in`, `/sign-up`), `share` (`/share/$token`), `not-found` (the splat shells and the `NotFoundPage` index routes), or `layout` (`__root__`). Those rows must not set `enumerate`. The check does not render them.
6. Rerun `pnpm --filter web verify:marketing`.

`kind` is not inferred from the file name. A marketing page recorded as `app` is classified, so P3 passes, and its anchors are never rendered. Set `marketing` on purpose.

## Coverage record

| What the check reads             | Where                                                                                                                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route tree and `createAppRouter` | `apps/web/src/router.tsx` `routeTree` line 335, `createAppRouter` line 364                                                                                                                                                    |
| Classification table             | `apps/web/src/test/marketing/route-table.ts` `ROUTE_TABLE` line 19                                                                                                                                                            |
| Not-found leaf                   | `NotFoundPage` in `apps/web/src/components/not-found-page.tsx` line 54. P1 treats a match as the not-found page when the leaf route's `component` is this function. Today those leaves are `/$/`, `/app/$/`, and `/u/$slug/`. |
| Render helper                    | `renderApp` in `apps/web/src/test/render-app.tsx` line 20                                                                                                                                                                     |
| Home page                        | `LandingPage` in `apps/web/src/features/landing/landing-page.tsx` line 18. Section ids include `product`, `stories`, `paper`, `apply`, `coach` (`id={product.id}` in `landing-products.tsx` line 12).                         |
| Pricing                          | `PricingPage` in `apps/web/src/features/landing/landing-pricing.tsx` line 22, route `apps/web/src/routes/landing-pricing.tsx`                                                                                                 |
| About                            | `AboutPage` in `apps/web/src/features/landing/about/about-page.tsx` line 24. Surface links use `hash` `paper`, `apply`, `coach` from `ABOUT_SURFACES` in `about-copy.ts`. Route `apps/web/src/routes/landing-about.tsx`.      |
| Help                             | `HelpPage` in `apps/web/src/features/landing/help/help-page.tsx` line 29. Topic links are `to="/help"` `hash={topic.id}`, and each topic section has `id={topic.id}`. Route `apps/web/src/routes/landing-help.tsx`.           |
| Nav hand list                    | `pageHref` in `apps/web/src/features/landing/landing-nav.tsx` line 17. `LANDING_NAV_LINKS` in `landing-copy.ts` line 43.                                                                                                      |
| Footer                           | `FooterAnchor` in `apps/web/src/features/landing/landing-footer.tsx` line 15. `LANDING_FOOTER` in `landing-copy.ts` line 268.                                                                                                 |
| Help search                      | `filterHelpTopics` line 276 and `HELP_TOPICS` line 42 in `apps/web/src/features/landing/help/help-copy.ts`. The property is `assertFilterRule` in `help-filter.property.test.ts` line 101.                                    |

P1 and P2 are `classificationProblems`, `marketingPaths`, and the link test in `marketing-links.verify.test.tsx`. They read rendered anchors. They do not read the copy arrays except by rendering the components that map over them.

Sync commit: `f9dcc4f0e4aea57ed3ed2b07c69aa1c78d3ff580` (main when this check was written; the covered files were reread at that commit and the command passed). Move the sync commit forward only after you reread every row of this table at the new commit, confirm the check still describes that code, and the command passes. A commit that only edits this skill does not move the covered code. Do not advance the sync commit for a blocked run.

## Bounds and assumptions

- P1–P3 render every `kind: "marketing"` path. Today that is `/`, `/pricing`, `/about`, and `/help`. No sample and no other pages.
- The session is signed out (`setMockSession(null)`). `indexRoute.beforeLoad` redirects a signed-in session from `/` to `/app`, so a signed-in render is not the marketing page.
- The check waits until `<main>` is on the page and `location.pathname` is that path. Marketing pages render their anchors in the route component, not in a later effect.
- An href is internal when `new URL(href, page)` stays on origin `http://marketing.test`. Other origins, `mailto:`, `tel:`, and protocol-relative URLs are external and skipped.
- The hash is `decodeURIComponent` of the fragment. The id check is `element.id` from the rendered document (`getElementById` semantics).
- A link's query string is ignored. The pathname is what is matched.
- Redirect routes (`/sign-up` to `/sign-in`, `/app` to the start page, `/app/proof` to `/app/proofs`) count as registered. The check does not follow the redirect.
- `enumerate` paths must be concrete, start with `/`, contain no `$`, and `matchRoutes` must land on that same route id.
- P4: fast-check 4.10.2, seed `449`, `200` runs. Queries are `""`, `" "`, `"\n\t"`, or a string of length at most 24. Generated topic lists have at most 8 topics, each with at most 6 questions, and titles, blurbs, questions, and answers of length at most 24. The HELP_TOPICS property also always runs the examples `""`, `" "`, `"PAPER"`, and `"hidden"`. Not every string.

## What this does not cover

- External links.
- Visual parity with the landing pen.
- A 404 Caddy serves for a path this router does not own.
- Ids inserted after the route component's first paint.
- The page a redirect lands on.
- Search strings.
- A marketing page filed as `app` or `auth` in the table.
- Signed-in `/`.
- Blog routes. They are not in the tree yet. When they land, P3 fails until you add rows.

## When the covered code changes

1. Run `pnpm --filter web verify:marketing` before you edit the table.
2. If you added or renamed a route, update `ROUTE_TABLE` in the same change. If you changed what `filterHelpTopics` promises, update the rule in this skill and in `assertFilterRule` only with evidence from the change, and say so.
3. Rerun the command. A failure that names a page and an href is a bug in the page. A failure that names a route id is the table.
4. Prove the check still fails on a scratch break, then drop the scratch. Useful breaks: remove `/help` from the `if` in `pageHref` (Help renders `/#elp`); rename the Coach section id in `landing-products.tsx` (`/#coach` fails, including the About link); add a route to `routeTree` without a table row; delete `.toLowerCase()` in `filterHelpTopics` (fast-check shrinks to a query such as `"A"`). `git checkout` the product file after. `git diff` on product files must be empty, and the command must pass again.
5. Move the sync commit only after that rerun, and only to a commit whose covered files you reread.

For drift that landed without this check, use `/maintain-formal-verification-skill`. Do not weaken a property so the current code passes.
