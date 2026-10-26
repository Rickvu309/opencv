# opencv

Personalised AI career coaching for Vietnamese early-career users, where the Coach can act in the product through the same actions the user can.

The design on branch `chore/350-design-kit-cli-skills` is the reference for release one. Where this file and another doc disagree on a word, this file wins.

## Language

**Product language**:
English for chrome, starter content, receipts, and the Coach persona. The EN/VI switch is drawn and stored on the profile, and nothing reads it yet.
_Avoid_: i18n, locale, Vietnamese-first

**User**:
A Vietnamese early-career person (student or new graduate) using opencv for themselves.
_Avoid_: Customer, client, account (for the person)

**Coach**:
The in-product AI mentor that can take product actions on the user's behalf.
_Avoid_: Bot, chatbot, assistant (for this role)

**Command**:
A named product action that changes state, available to the user and (when allowed) to the Coach.
_Avoid_: API call, mutation, tool (when you mean the product action)

**Profile**:
The user's structured self-description that coaching and features read from.
_Avoid_: Settings, account

**Paper**:
The user's application documents as product artifacts. CVs, Letters, and Proofs, kept in one drive-style workspace.
_Avoid_: Document (too vague)

**Letter**:
A cover letter for a specific Job, kept in Paper.
_Avoid_: Email, message

**Proof**:
A small evidence chain of context, then what I did, then outcome, with optional notes and photos, that backs a claim. A Paper doc type, citable from a CV and shown on Pitch. In release one the Proof surface is a placeholder.
_Avoid_: Case study, portfolio piece

**Pitch**:
A placeholder surface in release one ("coming soon"). The earlier portfolio page is retired. The future Pitch is one link with the CV and Proofs, built after the Proof flow.
_Avoid_: Portfolio page, script, content calendar, social feed

**Job**:
A job or internship the User tracks in Apply. Added by hand, or from a pasted link that fills the form (title, company, description, location, deadline). The Job carries the posting sections, a prep checklist, notes and an activity feed.
_Avoid_: Opportunity (retired 2026-10-26), opening, listing

**Search**:
Discovery of Jobs at scale (browse/find). Out of scope for now. Users bring Jobs in themselves.
_Avoid_: Job board (as the product)

**Apply**:
Tracking pursuit of a Job. A card moves through Stages, carries a Fit score, and shows its next Track on a kanban and calendar.
_Avoid_: Application (unless we promote that as the record name later)

**Stage**:
Where a Job sits in Apply. Saved, Applied, Interview, Offer, Closed. Closed is a hidden column. (Renamed 2026-10-26 from Inbox, Prep, Sent, Live, Closed. Inbox and Prep became Saved, Sent became Applied, Live became Interview.)
_Avoid_: Status, column, Inbox (now the mail surface), Prep, Sent, Live

**Track**:
The dated next event on an Apply card. Interview, deadline, follow-up, or applied.
_Avoid_: Reminder, todo

**Fit**:
A 0 to 100 estimate of how well the User's Profile matches a Job. The bare number versus showing its basis is an open product question (see PRODUCT.md).
_Avoid_: Match rate, compatibility

**Chat**:
One Coach conversation. Chats appear in Chat history grouped by day and can be resumed. A Chat opens as the Coach page or as the Coach panel over any page.
_Avoid_: Thread (retired 2026-10-26), session

**Connected apps**:
External services the User links to opencv (Gmail, Outlook, Google Calendar). Gmail is the Inbox provider when `GOOGLE_CLIENT_ID` is set. The other rows are drawn and not connected in release one.
_Avoid_: Integrations, plugins

**Inbox**:
The surface where recruiter emails appear, matched to Jobs, with move prompts and drafted replies. Local runs use a fake mail source. Gmail is the provider when `GOOGLE_CLIENT_ID` is set. Nothing is sent without the person's click.
_Avoid_: Mail, messages (for the surface), the old Stage name

**Plan**:
Free or Pro. Pro unlocks the Light and Max Coach tiers. In release one, Upgrade to Pro is a placeholder and Pro is granted by hand.
_Avoid_: Subscription, tier (for the plan), credits

**Start page**:
The page that opens after sign-in, chosen in Settings. Apply by default.
_Avoid_: Home (there is no Home screen)
