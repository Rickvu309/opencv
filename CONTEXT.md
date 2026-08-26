# OpenPath

Personalised AI career coaching for Vietnamese early-career users, where the Coach can act in the product through the same actions the user can.

Vocabulary follows the validated app-shell prototype (`prototype/app-shell`, frozen 2026-08-24). Where this file and older docs disagree, this file wins.

## Language

**Product language**:
English for chrome, starter content, receipts, and the Coach persona. No locale toggle. A User who writes in Vietnamese may still get an answer from the Coach as a model capability (ADR-0008 / QVE-150).
_Avoid_: i18n, locale, Vietnamese-first (until a follow-up ADR)

**User**:
A Vietnamese early-career person (student or new graduate) using OpenPath for themselves.
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
The user's application documents as product artifacts: CVs, Letters, and Proofs, kept in one drive-style workspace.
_Avoid_: Document (too vague)

**Letter**:
A cover letter for a specific Opportunity, kept in Paper.
_Avoid_: Email, message

**Proof**:
A small evidence chain — context → what I did → outcome, with optional notes and photos — that backs a claim. A Paper doc type, citable from a CV and shown on Pitch.
_Avoid_: Case study, portfolio piece

**Pitch**:
The user's shareable portfolio page for recruiters: about, achievements, experience, work, GitHub activity, story highlights, and gallery, published at a copyable link.
_Avoid_: Script, content calendar, post drafts (pre-prototype definition, superseded 2026-08-24), social feed

**Opportunity**:
A job or internship the User saved (form or pasted text/URL). URL paste may use best-effort fetch; if fetch fails, the User pastes the text.
_Avoid_: Opening, job (ambiguous), listing

**Search**:
Discovery of Opportunities at scale (browse/find). Out of scope for now; Users bring Opportunities in themselves.
_Avoid_: Job board (as the product)

**Apply**:
Tracking pursuit of an Opportunity: a card moves through Stages, carries a Fit score, and shows its next Track on a kanban and calendar.
_Avoid_: Application (unless we promote that as the record name later)

**Stage**:
Where an Apply card sits in the pipeline: Inbox, Prep, Sent, Live, Closed.
_Avoid_: Status (vague), column

**Track**:
The dated next event on an Apply card: interview, deadline, follow-up, or applied.
_Avoid_: Reminder, todo

**Fit**:
A 0–100 estimate of how well the User's Profile matches an Opportunity. The bare number vs. showing its basis is an open product question (see PRODUCT.md).
_Avoid_: Match rate, compatibility

**Thread**:
One Coach conversation. Recent Threads appear as History in the sidebar and can be resumed.
_Avoid_: Chat, session

**Connected apps**:
External services the User links to OpenPath (Gmail, Outlook, Google Calendar). Catalog stub only for now; no real OAuth.
_Avoid_: Integrations, plugins
