# Product

Release one is the product drawn in `design/opencv.pen` on branch `chore/350-design-kit-cli-skills`. Words are in `CONTEXT.md`. Decisions are in `docs/adr/`.

## Users

The user is a Vietnamese student or new graduate. They use opencv for themselves. A company is not a user in this release.

## Purpose

opencv is a career coach inside a working product. The Coach can take the same actions the person can. The person keeps a CV and a cover letter, tracks jobs, and reads recruiter mail in Inbox.

## Surfaces

### Sign-in

Sign-in is an email and a 6-digit code. There is no password. Codes go out through Resend. The Google button is drawn and shown only when `GOOGLE_CLIENT_ID` is set. The first successful code creates the account. A Welcome page follows. A session-expired overlay offers to continue as the same email or to email a new code. The EN/VI switch is drawn and inert.

### The shell

A signed-in screen has a sidebar, a main panel, and a bottom bar. The sidebar lists Inbox, Coach, and Jobs, then Paper, Apply, and Pitch, then favorites. The bottom bar holds recent Chats, a Coach button, and History. A Chat panel can open over any page. Under 768 px the sidebar is a drawer.

### Start page

The page that opens after sign-in is chosen in Settings. Apply is the default. There is no Home screen.

### Inbox

Inbox lists recruiter emails matched to Jobs. The person can read a thread, move the Job, and send a drafted reply. Nothing is sent without that click. Local runs use a fake mail source. Gmail is the provider when `GOOGLE_CLIENT_ID` is set.

### Coach

Coach is a page and a panel. A new Chat offers starters. Chat history is grouped by day. The composer has modes Free, Light, and Max. Light and Max need Pro. While the Coach works, the thread shows the steps it is taking. At the Free cap, a banner states the reset time and the composer waits.

### Jobs

Jobs is a coming-soon page. The person can ask to be notified, or track a job in Apply.

### Paper

Paper is a library of CVs, cover letters, Proofs, and imported files. The CV editor is a block document with templates, an import check, and a one-page fit prompt. A cover letter can be drafted from a Job. A suggestion can be added to the letter or skipped.

### Apply

Apply tracks Jobs on a board, a list, and a calendar. The stages are Saved, Applied, Interview, Offer, and Closed. Closed is a hidden column. The person adds a Job by hand. A pasted link fills the form and does not promise a scan. Job detail shows the posting, a prep checklist, notes, an activity feed, and properties.

### Pitch

Pitch is a coming-soon page. The old Pitch editor and public page are removed. The future Pitch is one link with the CV and Proofs, after the Proof flow.

### Settings

Settings has Preferences, Coach, Integrations, Usage and limits, Billing, and Account. Preferences include language, time zone, the start page, and notifications. Coach settings show week usage as a percentage, and toggles that read Enabled or Disabled. Usage and limits show the plan and the session and week percentages. Billing shows Free at $0 and Pro at $9 a month, with no card and no invoices. Account can change the email, export data, sign out, and delete the account.

## Plans

Free and Pro are the plans. Free routes Coach to OpenRouter free models. Pro routes Coach to Claude through the AI SDK Anthropic provider. Daily caps are configuration. The defaults are 20 for Free, 10 for Light, and 5 for Max. Usage is a percentage for the session and for the week. It is never a credit number.

## Placeholders

These ship as drawn, and do not do the full job yet.

- Jobs is a coming-soon page.
- Proof is a coming-soon page. The full Proof flow sits in the Later zone of the design.
- Pitch is a coming-soon page. The old Pitch code is removed.
- Upgrade to Pro is a placeholder. Pro is granted by hand.

Google sign-in and Gmail are behind `GOOGLE_CLIENT_ID`. They stay hidden until that variable is set.

## Out of scope

- The Later zone, including the full Proof flow.
- A job board. The person brings Jobs in.
- A payment provider.
- Vietnamese copy. The language switch stores a value and nothing reads it.
- A product for companies.
- Sending mail without a click.

## Open questions

1. Fit. The glossary defines a 0 to 100 estimate. The Apply board in the design does not show that number. The Jobs preview shows fit percentages on a faded board. Whether Apply shows Fit is unsettled.
2. A Coach session. The design shows a session percentage and a week percentage, with sample reset copy. The boundary of a session is not decided beyond that copy.
