# Map, OpenPath landing and the waiting list

`wayfinder:map`

## Destination

A stranger lands on `openpath-app.vercel.app`, understands what OpenPath is, and leaves
either **inside the demo** or **on the waiting list**, with that email stored somewhere
the team can actually read it.

Reached when both CTAs work on the deployed domain, an email submitted from the landing
page or from the end of the demo survives a redeploy, and the same address twice does not
create two rows.

## Notes

**Domain**, the landing page is the one surface in the **brand** register, not product
(`PRODUCT.md` distinguishes them). It is the first thing a stranger reads and the only
screen with no signed-in context.

**This map changes code**, same override as the other two maps: each ticket decides, lands
the code, and verifies against the deployed domain.

**The current landing page is deliberately simple and that is not the problem.** It scores
well: one heading, one paragraph, two buttons, three feature words. The problem is that
both CTAs point *into* the product and neither captures anyone who is not ready. Keep the
restraint; change what the buttons do.

**Two CTAs, in this order**, "Dùng thử OpenPath" (primary, into the demo) then "Tham gia
danh sách chờ" (secondary, the waiting list). Preferred-first ordering, per `better-writing`.

**Skills every session should consult**, `emil-design-eng` for feel and motion,
`better-writing` for the Vietnamese, `better-layout` and `better-accessibility` for the
form, `impeccable` (brand register) for the page itself.

**Standing constraint**, an email typed by a stranger is the only user input this product
takes from an unauthenticated visitor. It is validated on the server, never trusted from
the client, and never logged with the address in plain text alongside anything else.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [The waiting list: where an email actually goes](tickets/01-waiting-list.md), a
  **private** Vercel Blob store, provisioned and connected from here so
  `BLOB_READ_WRITE_TOKEN` exists in all three environments. One blob per address named by
  a hash of the normalized address, so dedupe is structural rather than a read-modify-write
  two submits could race, and the address never appears in a pathname. The first store was
  public by default and was deleted; that default is why this needed checking.
- [The landing page: two doors, and the restraint stays](tickets/02-landing.md), primary
  "Dùng thử OpenPath" into `/onboarding`, secondary "Tham gia danh sách chờ" opening in
  place. The page was never too simple; both its buttons led into the product.
- [The end of the journey: ask when the value has landed](tickets/03-end-of-journey.md),
  a dismissible strip on `/profile` after onboarding, never shown to someone who already
  joined, tagged `end-of-demo` so the two entry points stay distinguishable.

## Not yet specified

- **Whether the waiting list ever emails anyone back.** Confirmation mail, a welcome, an
  invite when a slot opens. All of it needs a sending domain and a provider, and none of
  it can be designed before there is a list.
- **What the team does with the list.** Export, a view inside the app, a webhook to a
  spreadsheet. Depends on how many rows arrive and who reads them.
- **Whether the demo should end at all.** "The end of the journey" assumes a journey with
  an end; the app is a loop by design. Where exactly the ask appears is a product question
  that needs the flow in front of someone.

## Out of scope

- **Real accounts.** The waiting list is a list of email addresses, not a signup. Nobody
  gets a password from it, and the demo credential stays shared. That decision lives on
  the backend map and is unchanged here.
- **Analytics and attribution.** Knowing *where* a visitor came from is a different
  effort with its own privacy decisions.
- **Redesigning the app screens.** Only the landing page is in the brand register; the
  archived UI/UX map still owns product-screen quality.
